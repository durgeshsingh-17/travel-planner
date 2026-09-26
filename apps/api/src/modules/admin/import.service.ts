import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { ValidationError, validate } from 'class-validator';

import { AuditService } from '../content/audit.service';
import { ContentValidationError, ContentWriterService } from '../content/content-writer.service';
import {
  ImportBundleDto,
  ImportCollectionDto,
  ImportDestinationDto,
  ImportPlaceDto,
  ImportStatus
} from './dto/import.dto';
import { PrismaService } from '../../database/prisma.service';
import { TagDocumentDto } from '../content/documents/tag-document.dto';
import { collectionHealth, destinationHealth, placeHealth } from '../content/shared/content-rules';
import { parseCsv } from '../../common/utils/csv.util';

type Tx = Prisma.TransactionClient;
type Entity = 'tag' | 'destination' | 'place' | 'collection' | 'location';

export interface ImportRowResult {
  entity: Entity;
  key: string;
  action: 'create' | 'update' | 'unchanged' | 'error';
  changes?: string[];
  published?: boolean;
  errors?: string[];
}

export interface ImportReport {
  dryRun: boolean;
  applied: boolean;
  summary: Record<Entity, { create: number; update: number; unchanged: number; error: number }>;
  rows: ImportRowResult[];
}

/** Thrown to roll back a dry run (or a failed apply) after the report is built. */
class Rollback extends Error {
  constructor(readonly report: ImportReport) {
    super('rollback');
  }
}

const PLACE_CSV_NUMBERS = [
  'latitude',
  'longitude',
  'rankInDestination',
  'averageVisitMinutes',
  'timeRequiredMinMinutes',
  'timeRequiredMaxMinutes',
  'estimatedCost',
  'entryFeeIndian',
  'entryFeeChild',
  'entryFeeForeigner',
  'rating'
];

/**
 * Bulk import. A dry run performs every write inside a transaction and then
 * rolls it back, so the preview is exactly what applying would do (including
 * places that reference destinations created earlier in the same file).
 * Applying is all-or-nothing: one bad row and nothing is written.
 */
@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: ContentWriterService,
    private readonly audit: AuditService
  ) {}

  async importBundle(bundle: ImportBundleDto, options: { dryRun: boolean; actorId: string | null }) {
    return this.run(options, async (tx, rows) => {
      for (const tag of bundle.tags ?? []) {
        rows.push(await this.row(tx, 'tag', tag.slug, () => this.importTag(tx, tag)));
      }

      for (const destination of bundle.destinations ?? []) {
        rows.push(
          await this.row(tx, 'destination', destination.slug, () =>
            this.importDestination(tx, destination, options.actorId)
          )
        );
      }

      for (const place of bundle.places ?? []) {
        rows.push(
          await this.row(tx, 'place', `${place.destinationSlug ?? place.destinationId}/${place.slug}`, () =>
            this.importPlace(tx, place, options.actorId)
          )
        );
      }

      for (const collection of bundle.collections ?? []) {
        rows.push(
          await this.row(tx, 'collection', collection.slug, () =>
            this.importCollection(tx, collection, options.actorId)
          )
        );
      }
    });
  }

  async importCsv(
    entity: 'locations' | 'places',
    csv: string,
    options: { dryRun: boolean; actorId: string | null }
  ) {
    let parsed: ReturnType<typeof parseCsv>;

    try {
      parsed = parseCsv(csv);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const required =
      entity === 'locations'
        ? ['slug', 'name', 'state', 'latitude', 'longitude']
        : ['destinationSlug', 'slug', 'name', 'category', 'description', 'latitude', 'longitude'];
    const missing = required.filter((column) => !parsed.header.includes(column));

    if (missing.length) {
      throw new BadRequestException(`CSV is missing columns: ${missing.join(', ')}`);
    }

    return this.run(options, async (tx, rows) => {
      for (const [index, raw] of parsed.rows.entries()) {
        const line = index + 2;

        if (entity === 'locations') {
          rows.push(await this.row(tx, 'location', raw.slug || `line ${line}`, () => this.importLocation(tx, raw, line)));
          continue;
        }

        const doc = this.placeFromCsv(raw);
        const errors = await this.validateDto(ImportPlaceDto, doc);
        rows.push(
          errors.length
            ? { entity: 'place', key: `line ${line}`, action: 'error', errors }
            : await this.row(tx, 'place', `${raw.destinationSlug}/${raw.slug}`, () =>
                this.importPlace(tx, plainToInstance(ImportPlaceDto, doc), options.actorId)
              )
        );
      }
    });
  }

  // ───────────────────────── Per-entity import ─────────────────────────

  private async importTag(tx: Tx, doc: TagDocumentDto): Promise<Omit<ImportRowResult, 'entity' | 'key'>> {
    const existing = await tx.tag.findUnique({ where: { slug: doc.slug }, select: { id: true } });
    const changes = existing ? this.writer.changedFields(await this.writer.exportTag(tx, existing.id), doc) : [];

    if (existing && !changes.length) {
      return { action: 'unchanged' };
    }

    await this.writer.saveTag(tx, doc, existing?.id);
    return { action: existing ? 'update' : 'create', changes };
  }

  private async importDestination(tx: Tx, input: ImportDestinationDto, actorId: string | null) {
    const { status, ...doc } = input;
    const existing = await tx.destination.findUnique({
      where: { slug: doc.slug },
      select: { id: true, status: true }
    });
    const current = existing ? await this.writer.exportDestination(tx, existing.id) : null;
    const changes = current ? this.writer.changedFields(current, doc) : [];
    const wantsPublish = status === 'PUBLISHED' && existing?.status !== 'PUBLISHED';

    if (existing && !changes.length && !wantsPublish) {
      return { action: 'unchanged' as const };
    }

    const { id } = await this.writer.saveDestination(tx, this.merge(current, doc), {
      id: existing?.id,
      actorId: actorId ?? undefined
    });
    const published = wantsPublish ? await this.publishDestination(tx, id) : undefined;
    return { action: existing ? ('update' as const) : ('create' as const), changes, published };
  }

  private async importPlace(tx: Tx, input: ImportPlaceDto, actorId: string | null) {
    const { status, ...doc } = input;
    const destination = await tx.destination.findFirst({
      where: doc.destinationId ? { id: doc.destinationId } : { slug: doc.destinationSlug },
      select: { id: true }
    });
    const existing = destination
      ? await tx.place.findFirst({
          where: { destinationId: destination.id, slug: doc.slug },
          select: { id: true, status: true }
        })
      : null;
    const current = existing ? await this.writer.exportPlace(tx, existing.id) : null;
    const changes = current ? this.writer.changedFields(current, doc) : [];
    const wantsPublish = status === 'PUBLISHED' && existing?.status !== 'PUBLISHED';

    if (existing && !changes.length && !wantsPublish) {
      return { action: 'unchanged' as const };
    }

    const { id } = await this.writer.savePlace(tx, this.merge(current, doc), {
      id: existing?.id,
      actorId: actorId ?? undefined
    });
    const published = wantsPublish ? await this.publishPlace(tx, id) : undefined;
    return { action: existing ? ('update' as const) : ('create' as const), changes, published };
  }

  private async importCollection(tx: Tx, input: ImportCollectionDto, actorId: string | null) {
    const { status, ...doc } = input;
    const existing = await tx.collection.findUnique({
      where: { slug: doc.slug },
      select: { id: true, status: true }
    });
    const current = existing ? await this.writer.exportCollection(tx, existing.id) : null;
    const changes = current ? this.writer.changedFields(current, doc) : [];
    const wantsPublish = status === 'PUBLISHED' && existing?.status !== 'PUBLISHED';

    if (existing && !changes.length && !wantsPublish) {
      return { action: 'unchanged' as const };
    }

    const { id } = await this.writer.saveCollection(tx, this.merge(current, doc), {
      id: existing?.id,
      actorId: actorId ?? undefined
    });
    const published = wantsPublish ? await this.publishCollection(tx, id) : undefined;
    return { action: existing ? ('update' as const) : ('create' as const), changes, published };
  }

  private async importLocation(tx: Tx, raw: Record<string, string>, line: number) {
    const errors: string[] = [];
    const latitude = Number(raw.latitude);
    const longitude = Number(raw.longitude);

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.slug ?? '')) errors.push(`line ${line}: invalid slug`);
    if (!raw.name) errors.push(`line ${line}: name is required`);
    if (!raw.state) errors.push(`line ${line}: state is required`);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.push(`line ${line}: invalid latitude`);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.push(`line ${line}: invalid longitude`);

    if (errors.length) {
      throw new ContentValidationError(errors);
    }

    const data = {
      slug: raw.slug,
      name: raw.name,
      state: raw.state,
      country: raw.country || 'India',
      latitude,
      longitude,
      aliases: this.list(raw.aliases),
      popularity: raw.popularity ? Number(raw.popularity) || 0 : 0,
      isActive: raw.isActive ? !/^(false|0|no)$/i.test(raw.isActive) : true
    };
    const existing = await tx.location.findUnique({ where: { slug: raw.slug } });

    if (existing) {
      const changes = Object.entries(data)
        .filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(key === 'latitude' || key === 'longitude'
          ? Number(existing[key as 'latitude'])
          : existing[key as keyof typeof existing]))
        .map(([key]) => key);

      if (!changes.length) {
        return { action: 'unchanged' as const };
      }

      await tx.location.update({ where: { id: existing.id }, data });
      return { action: 'update' as const, changes };
    }

    await tx.location.create({ data });
    return { action: 'create' as const };
  }

  // ───────────────────────── Publishing inside an import ─────────────────────────

  private async publishDestination(tx: Tx, id: string): Promise<boolean> {
    const row = await tx.destination.findUniqueOrThrow({
      where: { id },
      include: {
        _count: { select: { tags: true, months: true, howToReach: true, faqs: true, media: true, places: { where: { status: 'PUBLISHED' } } } }
      }
    });
    const health = destinationHealth({
      ...row,
      imageCount: row._count.media,
      hasCover: row._count.media > 0 || Boolean(row.heroImageUrl),
      monthCount: row._count.months,
      howToReachCount: row._count.howToReach,
      faqCount: row._count.faqs,
      tagCount: row._count.tags,
      publishedPlaceCount: row._count.places
    });
    this.assertPublishable(health.errors);
    await tx.destination.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    return true;
  }

  private async publishPlace(tx: Tx, id: string): Promise<boolean> {
    const row = await tx.place.findUniqueOrThrow({
      where: { id },
      include: {
        destination: { select: { status: true } },
        _count: { select: { tags: true, timings: true, media: true } }
      }
    });
    const health = placeHealth({
      ...row,
      entryFeeIndian: row.entryFeeIndian === null ? null : Number(row.entryFeeIndian),
      destinationPublished: row.destination.status === 'PUBLISHED',
      timingCount: row._count.timings,
      imageCount: row._count.media,
      tagCount: row._count.tags
    });
    this.assertPublishable(health.errors);
    await tx.place.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    return true;
  }

  private async publishCollection(tx: Tx, id: string): Promise<boolean> {
    const row = await tx.collection.findUniqueOrThrow({
      where: { id },
      include: {
        _count: {
          select: {
            media: true,
            items: {
              where: {
                OR: [
                  { destination: { status: 'PUBLISHED' } },
                  { place: { status: 'PUBLISHED', destination: { status: 'PUBLISHED' } } }
                ]
              }
            }
          }
        }
      }
    });
    const health = collectionHealth({
      intro: row.intro,
      publishedItemCount: row._count.items,
      hasCover: row._count.media > 0,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription
    });
    this.assertPublishable(health.errors);
    await tx.collection.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    return true;
  }

  private assertPublishable(errors: string[]): void {
    if (errors.length) {
      throw new ContentValidationError(errors.map((error) => `Cannot publish: ${error}`));
    }
  }

  // ───────────────────────── Plumbing ─────────────────────────

  private async run(
    options: { dryRun: boolean; actorId: string | null },
    work: (tx: Tx, rows: ImportRowResult[]) => Promise<void>
  ): Promise<ImportReport> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const rows: ImportRowResult[] = [];
          await work(tx, rows);
          const report = this.report(rows, options.dryRun);

          if (options.dryRun || report.rows.some((row) => row.action === 'error')) {
            throw new Rollback(report);
          }

          await this.audit.record(
            {
              actorId: options.actorId,
              action: 'IMPORT',
              entityType: 'IMPORT',
              entityId: new Date().toISOString(),
              summary: this.describe(report),
              changes: report.summary as unknown as Prisma.InputJsonValue
            },
            tx
          );

          return { ...report, applied: true };
        },
        { timeout: 120_000, maxWait: 10_000 }
      );
    } catch (error) {
      if (error instanceof Rollback) {
        return error.report;
      }

      throw error;
    }
  }

  /** Runs one row in a savepoint so a failing row cannot poison the rest of the transaction. */
  private async row(
    tx: Tx,
    entity: Entity,
    key: string,
    work: () => Promise<Omit<ImportRowResult, 'entity' | 'key'>>
  ): Promise<ImportRowResult> {
    await tx.$executeRawUnsafe('SAVEPOINT import_row');

    try {
      const result = await work();
      await tx.$executeRawUnsafe('RELEASE SAVEPOINT import_row');
      return { entity, key, ...result };
    } catch (error) {
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT import_row');
      return { entity, key, action: 'error', errors: this.messages(error) };
    }
  }

  private messages(error: unknown): string[] {
    if (error instanceof ContentValidationError) {
      return error.messages;
    }

    if (error instanceof HttpException) {
      const response = error.getResponse();
      const message = typeof response === 'object' && response && 'message' in response
        ? (response as { message: unknown }).message
        : error.message;
      return Array.isArray(message) ? message.map(String) : [String(message)];
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return [`Database rejected the row (${error.code})`];
    }

    throw error;
  }

  private report(rows: ImportRowResult[], dryRun: boolean): ImportReport {
    const blank = () => ({ create: 0, update: 0, unchanged: 0, error: 0 });
    const summary: ImportReport['summary'] = {
      tag: blank(),
      destination: blank(),
      place: blank(),
      collection: blank(),
      location: blank()
    };
    rows.forEach((row) => (summary[row.entity][row.action] += 1));

    return { dryRun, applied: false, summary, rows };
  }

  private describe(report: ImportReport): string {
    return Object.entries(report.summary)
      .filter(([, counts]) => counts.create + counts.update > 0)
      .map(([entity, counts]) => `${entity}: +${counts.create} ~${counts.update}`)
      .join(', ') || 'no changes';
  }

  private placeFromCsv(raw: Record<string, string>): Record<string, unknown> {
    const doc: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(raw)) {
      if (value === '') continue;

      if (PLACE_CSV_NUMBERS.includes(key)) {
        doc[key] = Number(value);
      } else if (key === 'isFree') {
        doc[key] = /^(true|1|yes)$/i.test(value);
      } else if (key === 'tips' || key === 'tags') {
        doc[key] = this.list(value);
      } else if (key === 'status') {
        doc[key] = value.toUpperCase() as ImportStatus;
      } else {
        doc[key] = value;
      }
    }

    return doc;
  }

  /**
   * Import rows are patches: fields a row leaves out keep their current value,
   * and `null` clears a field. (The admin editor always sends whole documents.)
   */
  private merge<T extends object>(current: T | null, incoming: T): T {
    if (!current) {
      return incoming;
    }

    const defined = Object.fromEntries(
      Object.entries(incoming).filter(([, value]) => value !== undefined)
    );
    return { ...current, ...defined } as T;
  }

  private list(value?: string): string[] {
    return (value ?? '')
      .split('|')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  private async validateDto(type: new () => object, plain: Record<string, unknown>): Promise<string[]> {
    const errors = await validate(plainToInstance(type, plain), {
      whitelist: true,
      forbidNonWhitelisted: true
    });
    const flatten = (entries: ValidationError[], prefix = ''): string[] =>
      entries.flatMap((entry) => [
        ...Object.values(entry.constraints ?? {}).map((message) => `${prefix}${message}`),
        ...flatten(entry.children ?? [], `${prefix}${entry.property}.`)
      ]);

    return flatten(errors);
  }
}
