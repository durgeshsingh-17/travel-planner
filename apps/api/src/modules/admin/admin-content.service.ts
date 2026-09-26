import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';

import { AuditService } from '../content/audit.service';
import { CollectionDocumentDto } from '../content/documents/collection-document.dto';
import {
  ContentHealth,
  collectionHealth,
  destinationHealth,
  placeHealth
} from '../content/shared/content-rules';
import { ContentValidationError, ContentWriterService } from '../content/content-writer.service';
import { DestinationDocumentDto } from '../content/documents/destination-document.dto';
import { PlaceDocumentDto } from '../content/documents/place-document.dto';
import { PrismaService } from '../../database/prisma.service';
import { TagDocumentDto } from '../content/documents/tag-document.dto';

export type ContentEntity = 'DESTINATION' | 'PLACE' | 'COLLECTION';

export interface AdminListQuery {
  q?: string;
  status?: ContentStatus;
  destinationId?: string;
  page?: number;
  pageSize?: number;
}

const destinationCounts = {
  _count: {
    select: {
      tags: true,
      months: true,
      howToReach: true,
      faqs: true,
      media: true,
      places: { where: { status: 'PUBLISHED' } }
    }
  },
  media: { where: { isCover: true }, select: { id: true }, take: 1 }
} satisfies Prisma.DestinationInclude;

const placeCounts = {
  _count: { select: { tags: true, timings: true, media: true } },
  destination: { select: { id: true, slug: true, name: true, status: true } }
} satisfies Prisma.PlaceInclude;

type DestinationWithCounts = Prisma.DestinationGetPayload<{ include: typeof destinationCounts }>;
type PlaceWithCounts = Prisma.PlaceGetPayload<{ include: typeof placeCounts }>;

/**
 * Editorial workflow for destinations, places, collections and tags:
 * documents in, documents out, publish rules enforced, every change audited.
 */
@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: ContentWriterService,
    private readonly audit: AuditService
  ) {}

  // ───────────────────────── Destinations ─────────────────────────

  async listDestinations(query: AdminListQuery) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 100);
    const where: Prisma.DestinationWhereInput = {
      status: query.status,
      OR: query.q
        ? [
            { name: { contains: query.q, mode: 'insensitive' } },
            { slug: { contains: query.q, mode: 'insensitive' } },
            { state: { contains: query.q, mode: 'insensitive' } }
          ]
        : undefined
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.destination.count({ where }),
      this.prisma.destination.findMany({
        where,
        include: destinationCounts,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        state: row.state,
        status: row.status,
        isFeatured: row.isFeatured,
        publishedAt: row.publishedAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
        publishedPlaceCount: row._count.places,
        health: this.destinationHealthOf(row)
      })),
      page,
      pageSize,
      total
    };
  }

  async getDestination(id: string) {
    const row = await this.prisma.destination.findUnique({ where: { id }, include: destinationCounts });

    if (!row) {
      throw new NotFoundException(`Destination '${id}' was not found`);
    }

    return {
      id: row.id,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      publishedPlaceCount: row._count.places,
      health: this.destinationHealthOf(row),
      document: await this.writer.exportDestination(this.prisma, id)
    };
  }

  async createDestination(doc: DestinationDocumentDto, actorId: string) {
    const { id } = await this.prisma.$transaction(async (tx) => {
      const result = await this.writer.saveDestination(tx, doc, { actorId });
      await this.audit.record(
        { actorId, action: 'CREATE', entityType: 'DESTINATION', entityId: result.id, summary: doc.name },
        tx
      );
      return result;
    });

    return this.getDestination(id);
  }

  async updateDestination(
    id: string,
    doc: DestinationDocumentDto,
    actorId: string,
    expectedUpdatedAt?: string
  ) {
    await this.prisma.$transaction(async (tx) => {
      const before = await this.lockForUpdate(tx, 'DESTINATION', id, expectedUpdatedAt);
      const changes = this.writer.changedFields(await this.writer.exportDestination(tx, id), doc);
      await this.writer.saveDestination(tx, doc, { id, actorId });
      await this.audit.record(
        { actorId, action: 'UPDATE', entityType: 'DESTINATION', entityId: id, summary: before.label, changes },
        tx
      );
    });

    return this.getDestination(id);
  }

  // ───────────────────────── Places ─────────────────────────

  async listPlaces(query: AdminListQuery) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 100);
    const where: Prisma.PlaceWhereInput = {
      status: query.status,
      destinationId: query.destinationId,
      OR: query.q
        ? [
            { name: { contains: query.q, mode: 'insensitive' } },
            { slug: { contains: query.q, mode: 'insensitive' } }
          ]
        : undefined
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.place.count({ where }),
      this.prisma.place.findMany({
        where,
        include: placeCounts,
        orderBy: [{ destination: { name: 'asc' } }, { rankInDestination: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        category: row.category,
        status: row.status,
        destination: row.destination,
        rankInDestination: row.rankInDestination,
        updatedAt: row.updatedAt.toISOString(),
        health: this.placeHealthOf(row)
      })),
      page,
      pageSize,
      total
    };
  }

  async getPlace(id: string) {
    const row = await this.prisma.place.findUnique({ where: { id }, include: placeCounts });

    if (!row) {
      throw new NotFoundException(`Place '${id}' was not found`);
    }

    return {
      id: row.id,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      destination: row.destination,
      health: this.placeHealthOf(row),
      document: await this.writer.exportPlace(this.prisma, id)
    };
  }

  async createPlace(doc: PlaceDocumentDto, actorId: string) {
    const { id } = await this.prisma.$transaction(async (tx) => {
      const result = await this.writer.savePlace(tx, doc, { actorId });
      await this.audit.record(
        { actorId, action: 'CREATE', entityType: 'PLACE', entityId: result.id, summary: doc.name },
        tx
      );
      return result;
    });

    return this.getPlace(id);
  }

  async updatePlace(id: string, doc: PlaceDocumentDto, actorId: string, expectedUpdatedAt?: string) {
    await this.prisma.$transaction(async (tx) => {
      const before = await this.lockForUpdate(tx, 'PLACE', id, expectedUpdatedAt);
      const changes = this.writer.changedFields(await this.writer.exportPlace(tx, id), doc);
      await this.writer.savePlace(tx, doc, { id, actorId });
      await this.audit.record(
        { actorId, action: 'UPDATE', entityType: 'PLACE', entityId: id, summary: before.label, changes },
        tx
      );
    });

    return this.getPlace(id);
  }

  // ───────────────────────── Collections ─────────────────────────

  async listCollections(query: AdminListQuery) {
    const rows = await this.prisma.collection.findMany({
      where: {
        status: query.status,
        title: query.q ? { contains: query.q, mode: 'insensitive' } : undefined
      },
      include: { _count: { select: { items: true } } },
      orderBy: { updatedAt: 'desc' }
    });

    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: row.status,
        isFeatured: row.isFeatured,
        itemCount: row._count.items,
        updatedAt: row.updatedAt.toISOString(),
        health: await this.collectionHealthOf(row.id)
      }))
    );
  }

  async getCollection(id: string) {
    const row = await this.prisma.collection.findUnique({ where: { id } });

    if (!row) {
      throw new NotFoundException(`Collection '${id}' was not found`);
    }

    return {
      id: row.id,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      health: await this.collectionHealthOf(id),
      document: await this.writer.exportCollection(this.prisma, id)
    };
  }

  async createCollection(doc: CollectionDocumentDto, actorId: string) {
    const { id } = await this.prisma.$transaction(async (tx) => {
      const result = await this.writer.saveCollection(tx, doc, { actorId });
      await this.audit.record(
        { actorId, action: 'CREATE', entityType: 'COLLECTION', entityId: result.id, summary: doc.title },
        tx
      );
      return result;
    });

    return this.getCollection(id);
  }

  async updateCollection(
    id: string,
    doc: CollectionDocumentDto,
    actorId: string,
    expectedUpdatedAt?: string
  ) {
    await this.prisma.$transaction(async (tx) => {
      const before = await this.lockForUpdate(tx, 'COLLECTION', id, expectedUpdatedAt);
      const changes = this.writer.changedFields(await this.writer.exportCollection(tx, id), doc);
      await this.writer.saveCollection(tx, doc, { id, actorId });
      await this.audit.record(
        { actorId, action: 'UPDATE', entityType: 'COLLECTION', entityId: id, summary: before.label, changes },
        tx
      );
    });

    return this.getCollection(id);
  }

  // ───────────────────────── Workflow shared by all three ─────────────────────────

  async health(entity: ContentEntity, id: string): Promise<ContentHealth> {
    if (entity === 'DESTINATION') {
      return (await this.getDestination(id)).health;
    }

    if (entity === 'PLACE') {
      return (await this.getPlace(id)).health;
    }

    return this.collectionHealthOf(id);
  }

  async setStatus(entity: ContentEntity, id: string, status: ContentStatus, actorId: string) {
    if (status === 'PUBLISHED') {
      const health = await this.health(entity, id);

      if (!health.canPublish) {
        throw new ContentValidationError(health.errors.map((error) => `Cannot publish: ${error}`));
      }
    }

    const data = {
      status,
      ...(status === 'PUBLISHED' ? { publishedAt: new Date() } : {})
    };

    await this.prisma.$transaction(async (tx) => {
      const current = await this.lockForUpdate(tx, entity, id);

      if (entity === 'DESTINATION') {
        await tx.destination.update({ where: { id }, data });
      } else if (entity === 'PLACE') {
        await tx.place.update({ where: { id }, data });
      } else {
        await tx.collection.update({ where: { id }, data });
      }

      await this.audit.record(
        {
          actorId,
          action: status === 'PUBLISHED' ? 'PUBLISH' : status === 'ARCHIVED' ? 'ARCHIVE' : 'UNPUBLISH',
          entityType: entity,
          entityId: id,
          summary: current.label
        },
        tx
      );
    });

    return entity === 'DESTINATION'
      ? this.getDestination(id)
      : entity === 'PLACE'
        ? this.getPlace(id)
        : this.getCollection(id);
  }

  /** Only drafts and archived content can be deleted; unpublish first. */
  async remove(entity: ContentEntity, id: string, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.lockForUpdate(tx, entity, id);

      if (current.status === 'PUBLISHED') {
        throw new ConflictException('Unpublish this before deleting it.');
      }

      if (entity === 'DESTINATION') {
        await tx.destination.delete({ where: { id } });
      } else if (entity === 'PLACE') {
        await tx.place.delete({ where: { id } });
      } else {
        await tx.collection.delete({ where: { id } });
      }

      await this.audit.record(
        { actorId, action: 'DELETE', entityType: entity, entityId: id, summary: current.label },
        tx
      );
    });

    return { id, deleted: true };
  }

  // ───────────────────────── Tags ─────────────────────────

  async listTags() {
    const tags = await this.prisma.tag.findMany({
      include: { _count: { select: { destinations: true, places: true } } },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }]
    });

    return tags.map(({ _count, ...tag }) => ({
      ...tag,
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString(),
      destinationCount: _count.destinations,
      placeCount: _count.places
    }));
  }

  async saveTag(doc: TagDocumentDto, actorId: string, id?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      if (id) {
        await tx.tag.findUniqueOrThrow({ where: { id } });
      }

      const saved = await this.writer.saveTag(tx, doc, id);
      await this.audit.record(
        { actorId, action: id ? 'UPDATE' : 'CREATE', entityType: 'TAG', entityId: saved.id, summary: doc.name },
        tx
      );
      return saved;
    });

    return this.prisma.tag.findUniqueOrThrow({ where: { id: result.id } });
  }

  async removeTag(id: string, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      const tag = await tx.tag.delete({ where: { id } });
      await this.audit.record({ actorId, action: 'DELETE', entityType: 'TAG', entityId: id, summary: tag.name }, tx);
    });

    return { id, deleted: true };
  }

  // ───────────────────────── Dashboard ─────────────────────────

  async contentHealthOverview() {
    const [destinations, places] = await Promise.all([
      this.prisma.destination.findMany({ include: destinationCounts }),
      this.prisma.place.findMany({ include: placeCounts })
    ]);
    const scoredDestinations = destinations.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      health: this.destinationHealthOf(row)
    }));
    const scoredPlaces = places.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      destination: row.destination.name,
      health: this.placeHealthOf(row)
    }));
    const summary = <T extends { status: ContentStatus; health: ContentHealth }>(rows: T[]) => ({
      total: rows.length,
      published: rows.filter((row) => row.status === 'PUBLISHED').length,
      draft: rows.filter((row) => row.status === 'DRAFT').length,
      averageScore: rows.length
        ? Math.round(rows.reduce((sum, row) => sum + row.health.score, 0) / rows.length)
        : null
    });
    const weakest = <T extends { health: ContentHealth }>(rows: T[]) =>
      [...rows].sort((a, b) => a.health.score - b.health.score).slice(0, 10);

    return {
      destinations: summary(scoredDestinations),
      places: summary(scoredPlaces),
      collections: {
        total: await this.prisma.collection.count(),
        published: await this.prisma.collection.count({ where: { status: 'PUBLISHED' } })
      },
      weakestDestinations: weakest(scoredDestinations),
      weakestPlaces: weakest(scoredPlaces)
    };
  }

  // ───────────────────────── Helpers ─────────────────────────

  destinationHealthOf(row: DestinationWithCounts): ContentHealth {
    return destinationHealth({
      shortDescription: row.shortDescription,
      overview: row.overview,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      idealDaysMin: row.idealDaysMin,
      nearestAirport: row.nearestAirport,
      nearestRailway: row.nearestRailway,
      imageCount: row._count.media,
      hasCover: row._count.media > 0 || Boolean(row.heroImageUrl),
      monthCount: row._count.months,
      howToReachCount: row._count.howToReach,
      faqCount: row._count.faqs,
      tagCount: row._count.tags,
      publishedPlaceCount: row._count.places
    });
  }

  placeHealthOf(row: PlaceWithCounts): ContentHealth {
    return placeHealth({
      description: row.description,
      overview: row.overview,
      destinationPublished: row.destination.status === 'PUBLISHED',
      timingCount: row._count.timings,
      isFree: row.isFree,
      entryFeeIndian: row.entryFeeIndian === null ? null : Number(row.entryFeeIndian),
      feeNotes: row.feeNotes,
      timeRequiredMinMinutes: row.timeRequiredMinMinutes,
      averageVisitMinutes: row.averageVisitMinutes,
      imageCount: row._count.media,
      tagCount: row._count.tags,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription
    });
  }

  private async collectionHealthOf(id: string): Promise<ContentHealth> {
    const collection = await this.prisma.collection.findUniqueOrThrow({
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

    return collectionHealth({
      intro: collection.intro,
      publishedItemCount: collection._count.items,
      hasCover: collection._count.media > 0,
      seoTitle: collection.seoTitle,
      seoDescription: collection.seoDescription
    });
  }

  /**
   * Loads the row (404 if missing) and, when the editor sent the version it
   * loaded, refuses to overwrite a newer save made by someone else.
   */
  private async lockForUpdate(
    tx: Prisma.TransactionClient,
    entity: ContentEntity,
    id: string,
    expectedUpdatedAt?: string
  ): Promise<{ label: string; status: ContentStatus }> {
    const row =
      entity === 'DESTINATION'
        ? await tx.destination.findUnique({ where: { id }, select: { name: true, status: true, updatedAt: true } })
        : entity === 'PLACE'
          ? await tx.place.findUnique({ where: { id }, select: { name: true, status: true, updatedAt: true } })
          : await tx.collection
              .findUnique({ where: { id }, select: { title: true, status: true, updatedAt: true } })
              .then((found) => found && { name: found.title, status: found.status, updatedAt: found.updatedAt });

    if (!row) {
      throw new NotFoundException(`${entity.toLowerCase()} '${id}' was not found`);
    }

    if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== row.updatedAt.getTime()) {
      throw new ConflictException(
        'Someone else saved this after you opened it. Reload to see their changes before saving.'
      );
    }

    return { label: row.name, status: row.status };
  }
}
