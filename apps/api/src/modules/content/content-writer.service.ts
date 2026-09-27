import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CollectionDocumentDto } from './documents/collection-document.dto';
import { DestinationDocumentDto } from './documents/destination-document.dto';
import { MediaRefDto } from './documents/common.dto';
import { PackageDocumentDto } from './documents/package-document.dto';
import { PlaceDocumentDto } from './documents/place-document.dto';
import { TagDocumentDto } from './documents/tag-document.dto';
import { decimalToNumber } from '../../common/utils/number.util';
import { mediaUrl } from './shared/media-url';

type Tx = Prisma.TransactionClient;

/** Validation failure listing every problem, so editors and importers can fix them in one pass. */
export class ContentValidationError extends BadRequestException {
  constructor(readonly messages: string[]) {
    super({ message: messages.join('; '), error: { messages } });
  }
}

export interface SaveResult {
  id: string;
  created: boolean;
}

export interface ExportedMediaRef {
  mediaId: string;
  url: string;
  altText: string;
  credit: string | null;
  license: string;
  isCover: boolean;
}

interface ResolvedMedia {
  mediaId: string;
  isCover: boolean;
}

/**
 * Reads and writes whole content documents. Both the admin editor and the bulk
 * importer go through here, so validation and nested-replacement rules exist once.
 */
@Injectable()
export class ContentWriterService {
  // ───────────────────────── Tags ─────────────────────────

  async saveTag(tx: Tx, doc: TagDocumentDto, id?: string): Promise<SaveResult> {
    await this.assertSlugFree(tx, 'tag', doc.slug, id);
    const data = {
      slug: doc.slug,
      name: doc.name.trim(),
      kind: doc.kind ?? 'THEME',
      description: doc.description ?? null
    };

    if (id) {
      await tx.tag.update({ where: { id }, data });
      return { id, created: false };
    }

    const created = await tx.tag.create({ data, select: { id: true } });
    return { id: created.id, created: true };
  }

  async exportTag(tx: Tx, id: string): Promise<TagDocumentDto> {
    const tag = await tx.tag.findUniqueOrThrow({ where: { id } });
    return { slug: tag.slug, name: tag.name, kind: tag.kind, description: tag.description };
  }

  // ───────────────────────── Destinations ─────────────────────────

  async saveDestination(
    tx: Tx,
    doc: DestinationDocumentDto,
    options: { id?: string; actorId?: string } = {}
  ): Promise<SaveResult> {
    const problems = this.destinationProblems(doc);
    const tagIds = doc.tags ? await this.resolveTags(tx, doc.tags, problems) : undefined;
    const media = doc.media
      ? await this.resolveMedia(tx, doc.media, problems, options.actorId)
      : undefined;

    if (problems.length) {
      throw new ContentValidationError(problems);
    }

    await this.assertSlugFree(tx, 'destination', doc.slug, options.id);
    const scalars = {
      slug: doc.slug,
      name: doc.name.trim(),
      state: doc.state.trim(),
      country: doc.country?.trim() || 'India',
      latitude: doc.latitude,
      longitude: doc.longitude,
      shortDescription: doc.shortDescription.trim(),
      tagline: doc.tagline ?? null,
      overview: doc.overview ?? null,
      rating: doc.rating ?? null,
      idealDaysMin: doc.idealDaysMin ?? null,
      idealDaysMax: doc.idealDaysMax ?? null,
      budgetPerDayMin: doc.budgetPerDayMin ?? null,
      budgetPerDayMax: doc.budgetPerDayMax ?? null,
      altitudeM: doc.altitudeM ?? null,
      nearestAirport: doc.nearestAirport ?? null,
      nearestAirportKm: doc.nearestAirportKm ?? null,
      nearestRailway: doc.nearestRailway ?? null,
      nearestRailwayKm: doc.nearestRailwayKm ?? null,
      bestTimeToVisit: doc.bestTimeToVisit ?? null,
      heroImageUrl: doc.heroImageUrl ?? null,
      popularityScore: doc.popularityScore ?? 0,
      isFeatured: doc.isFeatured ?? false,
      seoTitle: doc.seoTitle ?? null,
      seoDescription: doc.seoDescription ?? null
    } satisfies Prisma.DestinationUncheckedCreateInput;

    let id = options.id;
    let created = false;

    if (id) {
      const existing = await tx.destination.findUniqueOrThrow({
        where: { id },
        select: { slug: true, status: true }
      });
      await tx.destination.update({ where: { id }, data: scalars });

      if (existing.slug !== doc.slug && existing.status === 'PUBLISHED') {
        await this.recordRedirect(tx, 'DESTINATION', '', existing.slug, doc.slug);
      }
    } else {
      id = (await tx.destination.create({ data: scalars, select: { id: true } })).id;
      created = true;
    }

    if (tagIds) {
      await tx.destinationTag.deleteMany({ where: { destinationId: id } });
      await tx.destinationTag.createMany({
        data: tagIds.map((tagId) => ({ destinationId: id!, tagId }))
      });
    }

    if (doc.months) {
      await tx.destinationMonthInfo.deleteMany({ where: { destinationId: id } });
      await tx.destinationMonthInfo.createMany({
        data: doc.months.map((month) => ({
          destinationId: id!,
          month: month.month,
          rating: month.rating,
          avgMinC: month.avgMinC ?? null,
          avgMaxC: month.avgMaxC ?? null,
          rainfallMm: month.rainfallMm ?? null,
          notes: month.notes ?? null,
          events: month.events ?? []
        }))
      });
    }

    if (doc.howToReach) {
      await tx.howToReach.deleteMany({ where: { destinationId: id } });
      await tx.howToReach.createMany({
        data: doc.howToReach.map((route, index) => ({
          destinationId: id!,
          mode: route.mode,
          hubName: route.hubName.trim(),
          distanceKm: route.distanceKm ?? null,
          durationMinutes: route.durationMinutes ?? null,
          costMin: route.costMin ?? null,
          costMax: route.costMax ?? null,
          summary: route.summary.trim(),
          sortOrder: index
        }))
      });
    }

    if (doc.faqs) {
      await tx.faq.deleteMany({ where: { destinationId: id } });
      await tx.faq.createMany({
        data: doc.faqs.map((faq, index) => ({
          destinationId: id!,
          question: faq.question.trim(),
          answer: faq.answer.trim(),
          sortOrder: index
        }))
      });
    }

    if (media) {
      await this.replaceAttachments(tx, { destinationId: id }, media);
    }

    return { id, created };
  }

  async exportDestination(tx: Tx, id: string): Promise<DestinationDocumentDto> {
    const destination = await tx.destination.findUniqueOrThrow({
      where: { id },
      include: {
        tags: { include: { tag: { select: { slug: true } } } },
        months: { orderBy: { month: 'asc' } },
        howToReach: { orderBy: { sortOrder: 'asc' } },
        faqs: { orderBy: { sortOrder: 'asc' } },
        media: { orderBy: { sortOrder: 'asc' }, include: { media: true } }
      }
    });

    return {
      slug: destination.slug,
      name: destination.name,
      state: destination.state,
      country: destination.country,
      latitude: decimalToNumber(destination.latitude) ?? 0,
      longitude: decimalToNumber(destination.longitude) ?? 0,
      shortDescription: destination.shortDescription,
      tagline: destination.tagline,
      overview: destination.overview,
      rating: decimalToNumber(destination.rating),
      idealDaysMin: destination.idealDaysMin,
      idealDaysMax: destination.idealDaysMax,
      budgetPerDayMin: destination.budgetPerDayMin,
      budgetPerDayMax: destination.budgetPerDayMax,
      altitudeM: destination.altitudeM,
      nearestAirport: destination.nearestAirport,
      nearestAirportKm: destination.nearestAirportKm,
      nearestRailway: destination.nearestRailway,
      nearestRailwayKm: destination.nearestRailwayKm,
      bestTimeToVisit: destination.bestTimeToVisit,
      heroImageUrl: destination.heroImageUrl,
      popularityScore: destination.popularityScore,
      isFeatured: destination.isFeatured,
      seoTitle: destination.seoTitle,
      seoDescription: destination.seoDescription,
      tags: destination.tags.map((entry) => entry.tag.slug).sort(),
      months: destination.months.map((month) => ({
        month: month.month,
        rating: month.rating,
        avgMinC: month.avgMinC,
        avgMaxC: month.avgMaxC,
        rainfallMm: month.rainfallMm,
        notes: month.notes,
        events: month.events
      })),
      howToReach: destination.howToReach.map((route) => ({
        mode: route.mode,
        hubName: route.hubName,
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        costMin: route.costMin,
        costMax: route.costMax,
        summary: route.summary
      })),
      faqs: destination.faqs.map((faq) => ({ question: faq.question, answer: faq.answer })),
      media: destination.media.map((attachment) => this.exportMediaRef(attachment))
    };
  }

  // ───────────────────────── Places ─────────────────────────

  async savePlace(
    tx: Tx,
    doc: PlaceDocumentDto,
    options: { id?: string; actorId?: string } = {}
  ): Promise<SaveResult> {
    const problems = this.placeProblems(doc);
    const destination = await this.resolveDestination(tx, doc, problems);
    const tagIds = doc.tags ? await this.resolveTags(tx, doc.tags, problems) : undefined;
    const media = doc.media
      ? await this.resolveMedia(tx, doc.media, problems, options.actorId)
      : undefined;

    if (problems.length || !destination) {
      throw new ContentValidationError(problems);
    }

    const clash = await tx.place.findFirst({
      where: {
        destinationId: destination.id,
        slug: doc.slug,
        ...(options.id ? { id: { not: options.id } } : {})
      },
      select: { id: true }
    });

    if (clash) {
      throw new ConflictException(`A place with slug '${doc.slug}' already exists in ${destination.slug}`);
    }

    const isFree = doc.isFree ?? false;
    const scalars = {
      destinationId: destination.id,
      slug: doc.slug,
      name: doc.name.trim(),
      category: doc.category,
      description: doc.description.trim(),
      overview: doc.overview ?? null,
      latitude: doc.latitude,
      longitude: doc.longitude,
      rankInDestination: doc.rankInDestination ?? null,
      averageVisitMinutes: doc.averageVisitMinutes ?? null,
      timeRequiredMinMinutes: doc.timeRequiredMinMinutes ?? null,
      timeRequiredMaxMinutes: doc.timeRequiredMaxMinutes ?? null,
      estimatedCost: isFree ? 0 : (doc.estimatedCost ?? null),
      entryFeeIndian: isFree ? null : (doc.entryFeeIndian ?? null),
      entryFeeChild: isFree ? null : (doc.entryFeeChild ?? null),
      entryFeeForeigner: isFree ? null : (doc.entryFeeForeigner ?? null),
      feeNotes: doc.feeNotes ?? null,
      isFree,
      bestTimeOfDay: doc.bestTimeOfDay ?? null,
      tips: (doc.tips ?? []).map((tip) => tip.trim()).filter(Boolean),
      address: doc.address ?? null,
      rating: doc.rating ?? null,
      seoTitle: doc.seoTitle ?? null,
      seoDescription: doc.seoDescription ?? null
    } satisfies Prisma.PlaceUncheckedCreateInput;

    let id = options.id;
    let created = false;

    if (id) {
      const existing = await tx.place.findUniqueOrThrow({
        where: { id },
        select: { slug: true, status: true, destination: { select: { slug: true } } }
      });
      await tx.place.update({ where: { id }, data: scalars });

      if (existing.slug !== doc.slug && existing.status === 'PUBLISHED') {
        await this.recordRedirect(tx, 'PLACE', existing.destination.slug, existing.slug, doc.slug);
      }
    } else {
      id = (await tx.place.create({ data: scalars, select: { id: true } })).id;
      created = true;
    }

    if (tagIds) {
      await tx.placeTag.deleteMany({ where: { placeId: id } });
      await tx.placeTag.createMany({ data: tagIds.map((tagId) => ({ placeId: id!, tagId })) });
    }

    if (doc.timings) {
      await tx.placeTiming.deleteMany({ where: { placeId: id } });
      await tx.placeTiming.createMany({
        data: doc.timings.map((timing) => ({
          placeId: id!,
          dayOfWeek: timing.dayOfWeek,
          isClosed: timing.isClosed ?? false,
          opensAt: timing.isClosed ? null : (timing.opensAt ?? null),
          closesAt: timing.isClosed ? null : (timing.closesAt ?? null)
        }))
      });
    }

    if (doc.faqs) {
      await tx.faq.deleteMany({ where: { placeId: id } });
      await tx.faq.createMany({
        data: doc.faqs.map((faq, index) => ({
          placeId: id!,
          question: faq.question.trim(),
          answer: faq.answer.trim(),
          sortOrder: index
        }))
      });
    }

    if (media) {
      await this.replaceAttachments(tx, { placeId: id }, media);
    }

    return { id, created };
  }

  async exportPlace(tx: Tx, id: string): Promise<PlaceDocumentDto> {
    const place = await tx.place.findUniqueOrThrow({
      where: { id },
      include: {
        destination: { select: { id: true, slug: true } },
        tags: { include: { tag: { select: { slug: true } } } },
        timings: { orderBy: { dayOfWeek: 'asc' } },
        faqs: { orderBy: { sortOrder: 'asc' } },
        media: { orderBy: { sortOrder: 'asc' }, include: { media: true } }
      }
    });

    return {
      destinationId: place.destination.id,
      destinationSlug: place.destination.slug,
      slug: place.slug,
      name: place.name,
      category: place.category,
      description: place.description,
      overview: place.overview,
      latitude: decimalToNumber(place.latitude) ?? 0,
      longitude: decimalToNumber(place.longitude) ?? 0,
      rankInDestination: place.rankInDestination,
      averageVisitMinutes: place.averageVisitMinutes,
      timeRequiredMinMinutes: place.timeRequiredMinMinutes,
      timeRequiredMaxMinutes: place.timeRequiredMaxMinutes,
      estimatedCost: decimalToNumber(place.estimatedCost),
      entryFeeIndian: decimalToNumber(place.entryFeeIndian),
      entryFeeChild: decimalToNumber(place.entryFeeChild),
      entryFeeForeigner: decimalToNumber(place.entryFeeForeigner),
      feeNotes: place.feeNotes,
      isFree: place.isFree,
      bestTimeOfDay: place.bestTimeOfDay,
      tips: place.tips,
      address: place.address,
      rating: decimalToNumber(place.rating),
      seoTitle: place.seoTitle,
      seoDescription: place.seoDescription,
      tags: place.tags.map((entry) => entry.tag.slug).sort(),
      timings: place.timings.map((timing) => ({
        dayOfWeek: timing.dayOfWeek,
        isClosed: timing.isClosed,
        opensAt: timing.opensAt,
        closesAt: timing.closesAt
      })),
      faqs: place.faqs.map((faq) => ({ question: faq.question, answer: faq.answer })),
      media: place.media.map((attachment) => this.exportMediaRef(attachment))
    };
  }

  // ───────────────────────── Collections ─────────────────────────

  async saveCollection(
    tx: Tx,
    doc: CollectionDocumentDto,
    options: { id?: string; actorId?: string } = {}
  ): Promise<SaveResult> {
    const problems: string[] = [];
    const items = doc.items ? await this.resolveCollectionItems(tx, doc.items, problems) : undefined;
    const media = doc.media
      ? await this.resolveMedia(tx, doc.media, problems, options.actorId)
      : undefined;

    if (problems.length) {
      throw new ContentValidationError(problems);
    }

    await this.assertSlugFree(tx, 'collection', doc.slug, options.id);
    const scalars = {
      slug: doc.slug,
      title: doc.title.trim(),
      intro: doc.intro.trim(),
      body: doc.body ?? null,
      isFeatured: doc.isFeatured ?? false,
      seoTitle: doc.seoTitle ?? null,
      seoDescription: doc.seoDescription ?? null
    };

    let id = options.id;
    let created = false;

    if (id) {
      const existing = await tx.collection.findUniqueOrThrow({
        where: { id },
        select: { slug: true, status: true }
      });
      await tx.collection.update({ where: { id }, data: scalars });

      if (existing.slug !== doc.slug && existing.status === 'PUBLISHED') {
        await this.recordRedirect(tx, 'COLLECTION', '', existing.slug, doc.slug);
      }
    } else {
      id = (await tx.collection.create({ data: scalars, select: { id: true } })).id;
      created = true;
    }

    if (items) {
      await tx.collectionItem.deleteMany({ where: { collectionId: id } });
      await tx.collectionItem.createMany({
        data: items.map((item, index) => ({ ...item, collectionId: id!, sortOrder: index }))
      });
    }

    if (media) {
      await this.replaceAttachments(tx, { collectionId: id }, media);
    }

    return { id, created };
  }

  async exportCollection(tx: Tx, id: string): Promise<CollectionDocumentDto> {
    const collection = await tx.collection.findUniqueOrThrow({
      where: { id },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            destination: { select: { id: true, slug: true } },
            place: { select: { id: true, slug: true, destination: { select: { id: true, slug: true } } } }
          }
        },
        media: { orderBy: { sortOrder: 'asc' }, include: { media: true } }
      }
    });

    return {
      slug: collection.slug,
      title: collection.title,
      intro: collection.intro,
      body: collection.body,
      isFeatured: collection.isFeatured,
      seoTitle: collection.seoTitle,
      seoDescription: collection.seoDescription,
      items: collection.items.map((item) =>
        item.place
          ? {
              placeId: item.place.id,
              destinationId: item.place.destination.id,
              destinationSlug: item.place.destination.slug,
              placeSlug: item.place.slug,
              blurb: item.blurb
            }
          : {
              destinationId: item.destination!.id,
              destinationSlug: item.destination!.slug,
              blurb: item.blurb
            }
      ),
      media: collection.media.map((attachment) => this.exportMediaRef(attachment))
    };
  }

  // ───────────────────────── Packages ─────────────────────────

  async savePackage(
    tx: Tx,
    doc: PackageDocumentDto,
    options: { id?: string; actorId?: string } = {}
  ): Promise<SaveResult> {
    const problems = this.packageProblems(doc);
    const slugs = new Set<string>([
      ...(doc.route ?? []).map((stop) => stop.destinationSlug),
      ...(doc.stays ?? []).map((stay) => stay.destinationSlug),
      ...(doc.days ?? []).flatMap((day) => [
        ...(day.overnightDestinationSlug ? [day.overnightDestinationSlug] : []),
        ...(day.places ?? []).map((place) => place.destinationSlug)
      ])
    ]);
    const destinations = new Map(
      (
        await tx.destination.findMany({
          where: { slug: { in: [...slugs] } },
          select: { id: true, slug: true }
        })
      ).map((destination) => [destination.slug, destination.id])
    );
    [...slugs]
      .filter((slug) => !destinations.has(slug))
      .forEach((slug) => problems.push(`Unknown destination '${slug}'`));
    const placeRefs = (doc.days ?? []).flatMap((day) => day.places ?? []);
    const places = new Map(
      (
        await tx.place.findMany({
          where: {
            OR: placeRefs.map((ref) => ({ slug: ref.placeSlug, destination: { slug: ref.destinationSlug } }))
          },
          select: { id: true, slug: true, destination: { select: { slug: true } } }
        })
      ).map((place) => [`${place.destination.slug}/${place.slug}`, place.id])
    );
    placeRefs
      .filter((ref) => !places.has(`${ref.destinationSlug}/${ref.placeSlug}`))
      .forEach((ref) => problems.push(`Unknown place '${ref.destinationSlug}/${ref.placeSlug}'`));
    const startLocation = doc.startLocationSlug
      ? await tx.location.findUnique({ where: { slug: doc.startLocationSlug }, select: { id: true } })
      : null;

    if (doc.startLocationSlug && !startLocation) {
      problems.push(`Unknown start city '${doc.startLocationSlug}'`);
    }

    const tagIds = doc.tags ? await this.resolveTags(tx, doc.tags, problems) : undefined;
    const media = doc.media ? await this.resolveMedia(tx, doc.media, problems, options.actorId) : undefined;

    if (problems.length) {
      throw new ContentValidationError(problems);
    }

    await this.assertSlugFree(tx, 'package', doc.slug, options.id);
    const scalars = {
      slug: doc.slug,
      title: doc.title.trim(),
      summary: doc.summary.trim(),
      overview: doc.overview ?? null,
      durationDays: doc.durationDays,
      durationNights: doc.durationNights,
      startLocationId: startLocation?.id ?? null,
      availableMonths: [...new Set(doc.availableMonths ?? [])].sort((a, b) => a - b),
      minPax: doc.minPax ?? 1,
      maxPax: doc.maxPax ?? null,
      isCustomizable: doc.isCustomizable ?? true,
      popularityScore: doc.popularityScore ?? 0,
      isFeatured: doc.isFeatured ?? false,
      seoTitle: doc.seoTitle ?? null,
      seoDescription: doc.seoDescription ?? null
    } satisfies Prisma.PackageUncheckedCreateInput;

    let id = options.id;
    let created = false;

    if (id) {
      const existing = await tx.package.findUniqueOrThrow({ where: { id }, select: { slug: true, status: true } });
      await tx.package.update({ where: { id }, data: scalars });

      if (existing.slug !== doc.slug && existing.status === 'PUBLISHED') {
        await this.recordRedirect(tx, 'PACKAGE', '', existing.slug, doc.slug);
      }
    } else {
      id = (await tx.package.create({ data: scalars, select: { id: true } })).id;
      created = true;
    }

    const packageId = id;

    if (doc.route) {
      await tx.packageDestination.deleteMany({ where: { packageId } });
      await tx.packageDestination.createMany({
        data: doc.route.map((stop, index) => ({
          packageId,
          destinationId: destinations.get(stop.destinationSlug)!,
          nights: stop.nights,
          sortOrder: index
        }))
      });
    }

    if (doc.tiers) {
      await tx.packageTier.deleteMany({ where: { packageId } });
      await tx.packageTier.createMany({
        data: doc.tiers.map((tier) => ({
          packageId,
          level: tier.level,
          pricePerPerson: tier.pricePerPerson,
          compareAtPrice: tier.compareAtPrice ?? null,
          childPrice: tier.childPrice ?? null,
          singleSupplement: tier.singleSupplement ?? null,
          taxesIncluded: tier.taxesIncluded ?? false,
          hotelCategory: tier.hotelCategory ?? null,
          transportNote: tier.transportNote ?? null
        }))
      });
    }

    const tiers = await tx.packageTier.findMany({ where: { packageId }, select: { pricePerPerson: true } });
    await tx.package.update({
      where: { id: packageId },
      data: { fromPrice: tiers.length ? Math.min(...tiers.map((tier) => tier.pricePerPerson)) : null }
    });

    if (doc.days) {
      await tx.packageDay.deleteMany({ where: { packageId } });

      for (const day of [...doc.days].sort((a, b) => a.dayNumber - b.dayNumber)) {
        await tx.packageDay.create({
          data: {
            packageId,
            dayNumber: day.dayNumber,
            title: day.title.trim(),
            description: day.description.trim(),
            overnightDestinationId: day.overnightDestinationSlug
              ? destinations.get(day.overnightDestinationSlug)!
              : null,
            mealsIncluded: ['B', 'L', 'D'].filter((meal) => (day.mealsIncluded ?? []).includes(meal)),
            places: {
              create: (day.places ?? []).map((ref, index) => ({
                placeId: places.get(`${ref.destinationSlug}/${ref.placeSlug}`)!,
                sortOrder: index
              }))
            }
          }
        });
      }
    }

    if (doc.stays) {
      await tx.packageStay.deleteMany({ where: { packageId } });
      await tx.packageStay.createMany({
        data: doc.stays.map((stay, index) => ({
          packageId,
          tierLevel: stay.tierLevel,
          destinationId: destinations.get(stay.destinationSlug)!,
          nights: stay.nights,
          hotelName: stay.hotelName.trim(),
          orSimilar: stay.orSimilar ?? true,
          hotelCategory: stay.hotelCategory ?? null,
          roomType: stay.roomType ?? null,
          mealPlan: stay.mealPlan,
          sortOrder: index
        }))
      });
    }

    if (doc.inclusions || doc.exclusions) {
      const replace = [
        ...(doc.inclusions ? (['INCLUSION'] as const) : []),
        ...(doc.exclusions ? (['EXCLUSION'] as const) : [])
      ];
      await tx.packageInclusion.deleteMany({ where: { packageId, type: { in: [...replace] } } });
      await tx.packageInclusion.createMany({
        data: [
          ...(doc.inclusions ?? []).map((text, index) => ({ packageId, type: 'INCLUSION' as const, text: text.trim(), sortOrder: index })),
          ...(doc.exclusions ?? []).map((text, index) => ({ packageId, type: 'EXCLUSION' as const, text: text.trim(), sortOrder: index }))
        ].filter((entry) => entry.text)
      });
    }

    if (doc.policies) {
      await tx.packagePolicy.deleteMany({ where: { packageId } });
      await tx.packagePolicy.createMany({
        data: doc.policies.map((policy) => ({ packageId, kind: policy.kind, body: policy.body.trim() }))
      });
    }

    if (tagIds) {
      await tx.packageTag.deleteMany({ where: { packageId } });
      await tx.packageTag.createMany({ data: tagIds.map((tagId) => ({ packageId, tagId })) });
    }

    if (doc.faqs) {
      await tx.faq.deleteMany({ where: { packageId } });
      await tx.faq.createMany({
        data: doc.faqs.map((faq, index) => ({ packageId, question: faq.question.trim(), answer: faq.answer.trim(), sortOrder: index }))
      });
    }

    if (media) {
      await this.replaceAttachments(tx, { packageId }, media);
    }

    return { id: packageId, created };
  }

  async exportPackage(tx: Tx, id: string): Promise<PackageDocumentDto> {
    const pkg = await tx.package.findUniqueOrThrow({
      where: { id },
      include: {
        startLocation: { select: { slug: true } },
        destinations: { orderBy: { sortOrder: 'asc' }, include: { destination: { select: { slug: true } } } },
        tiers: true,
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            overnightDestination: { select: { slug: true } },
            places: {
              orderBy: { sortOrder: 'asc' },
              include: { place: { select: { slug: true, destination: { select: { slug: true } } } } }
            }
          }
        },
        stays: { orderBy: [{ tierLevel: 'asc' }, { sortOrder: 'asc' }], include: { destination: { select: { slug: true } } } },
        inclusions: { orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] },
        policies: true,
        tags: { include: { tag: { select: { slug: true } } } },
        faqs: { orderBy: { sortOrder: 'asc' } },
        media: { orderBy: { sortOrder: 'asc' }, include: { media: true } }
      }
    });
    const tierOrder = ['BUDGET', 'MID_RANGE', 'PREMIUM', 'LUXURY'];
    const policyOrder = ['CANCELLATION', 'PAYMENT', 'CHILD', 'GENERAL'];

    return {
      slug: pkg.slug,
      title: pkg.title,
      summary: pkg.summary,
      overview: pkg.overview,
      durationDays: pkg.durationDays,
      durationNights: pkg.durationNights,
      startLocationSlug: pkg.startLocation?.slug ?? null,
      availableMonths: pkg.availableMonths,
      minPax: pkg.minPax,
      maxPax: pkg.maxPax,
      isCustomizable: pkg.isCustomizable,
      popularityScore: pkg.popularityScore,
      isFeatured: pkg.isFeatured,
      seoTitle: pkg.seoTitle,
      seoDescription: pkg.seoDescription,
      tags: pkg.tags.map((entry) => entry.tag.slug).sort(),
      route: pkg.destinations.map((stop) => ({ destinationSlug: stop.destination.slug, nights: stop.nights })),
      tiers: [...pkg.tiers]
        .sort((a, b) => tierOrder.indexOf(a.level) - tierOrder.indexOf(b.level))
        .map((tier) => ({
          level: tier.level,
          pricePerPerson: tier.pricePerPerson,
          compareAtPrice: tier.compareAtPrice,
          childPrice: tier.childPrice,
          singleSupplement: tier.singleSupplement,
          taxesIncluded: tier.taxesIncluded,
          hotelCategory: tier.hotelCategory,
          transportNote: tier.transportNote
        })),
      days: pkg.days.map((day) => ({
        dayNumber: day.dayNumber,
        title: day.title,
        description: day.description,
        overnightDestinationSlug: day.overnightDestination?.slug ?? null,
        mealsIncluded: day.mealsIncluded,
        places: day.places.map((entry) => ({
          destinationSlug: entry.place.destination.slug,
          placeSlug: entry.place.slug
        }))
      })),
      stays: pkg.stays.map((stay) => ({
        tierLevel: stay.tierLevel,
        destinationSlug: stay.destination.slug,
        nights: stay.nights,
        hotelName: stay.hotelName,
        orSimilar: stay.orSimilar,
        hotelCategory: stay.hotelCategory,
        roomType: stay.roomType,
        mealPlan: stay.mealPlan
      })),
      inclusions: pkg.inclusions.filter((entry) => entry.type === 'INCLUSION').map((entry) => entry.text),
      exclusions: pkg.inclusions.filter((entry) => entry.type === 'EXCLUSION').map((entry) => entry.text),
      policies: [...pkg.policies]
        .sort((a, b) => policyOrder.indexOf(a.kind) - policyOrder.indexOf(b.kind))
        .map((policy) => ({ kind: policy.kind, body: policy.body })),
      faqs: pkg.faqs.map((faq) => ({ question: faq.question, answer: faq.answer })),
      media: pkg.media.map((attachment) => this.exportMediaRef(attachment))
    };
  }

  // ───────────────────────── Diffing (importer dry runs) ─────────────────────────

  /** Names of fields in `incoming` whose value differs from `existing`. */
  changedFields(existing: object, incoming: object): string[] {
    const current = existing as Record<string, unknown>;

    return Object.entries(incoming)
      .filter(([, value]) => value !== undefined)
      .filter(([key, value]) => {
        if (key === 'destinationId' || key === 'destinationSlug') {
          return false;
        }

        return this.normalizeForDiff(key, current[key]) !== this.normalizeForDiff(key, value);
      })
      .map(([key]) => key);
  }

  private normalizeForDiff(key: string, value: unknown): string {
    if (key === 'media' && Array.isArray(value)) {
      const refs = value as Array<{ url?: string; mediaId?: string; isCover?: boolean }>;
      return JSON.stringify(
        refs.map((ref, index) => [ref.url ?? ref.mediaId, ref.isCover ?? index === 0])
      );
    }

    if (key === 'items' && Array.isArray(value)) {
      const items = value as Array<{ destinationSlug?: string; placeSlug?: string; blurb?: string | null }>;
      return JSON.stringify(
        items.map((item) => [item.destinationSlug, item.placeSlug ?? null, item.blurb ?? null])
      );
    }

    if (key === 'tags' && Array.isArray(value)) {
      return JSON.stringify([...(value as string[])].sort());
    }

    return JSON.stringify(this.stripEmpty(value));
  }

  /** Treat null, undefined and missing optional fields inside nested objects as equal. */
  private stripEmpty(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.stripEmpty(entry));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, entry]) => entry !== null && entry !== undefined && !(Array.isArray(entry) && entry.length === 0))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, this.stripEmpty(entry)])
      );
    }

    return value ?? null;
  }

  // ───────────────────────── Validation helpers ─────────────────────────

  private destinationProblems(doc: DestinationDocumentDto): string[] {
    const problems: string[] = [];

    if (doc.idealDaysMin && doc.idealDaysMax && doc.idealDaysMin > doc.idealDaysMax) {
      problems.push('Ideal duration minimum cannot exceed the maximum');
    }

    if (
      doc.budgetPerDayMin != null &&
      doc.budgetPerDayMax != null &&
      doc.budgetPerDayMin > doc.budgetPerDayMax
    ) {
      problems.push('Budget per day minimum cannot exceed the maximum');
    }

    const months = doc.months ?? [];
    if (new Set(months.map((month) => month.month)).size !== months.length) {
      problems.push('Each month can appear only once');
    }

    months.forEach((month) => {
      if (month.avgMinC != null && month.avgMaxC != null && month.avgMinC > month.avgMaxC) {
        problems.push(`Month ${month.month}: minimum temperature is above the maximum`);
      }
    });

    (doc.howToReach ?? []).forEach((route, index) => {
      if (route.costMin != null && route.costMax != null && route.costMin > route.costMax) {
        problems.push(`How to reach #${index + 1}: minimum cost is above the maximum`);
      }
    });

    this.checkCovers(doc.media, problems);
    return problems;
  }

  private placeProblems(doc: PlaceDocumentDto): string[] {
    const problems: string[] = [];

    if (
      doc.timeRequiredMinMinutes &&
      doc.timeRequiredMaxMinutes &&
      doc.timeRequiredMinMinutes > doc.timeRequiredMaxMinutes
    ) {
      problems.push('Time required minimum cannot exceed the maximum');
    }

    if (doc.isFree && [doc.entryFeeIndian, doc.entryFeeChild, doc.entryFeeForeigner].some((fee) => fee)) {
      problems.push('A free place cannot have entry fees');
    }

    const timings = doc.timings ?? [];
    if (new Set(timings.map((timing) => timing.dayOfWeek)).size !== timings.length) {
      problems.push('Each weekday can appear only once in opening hours');
    }

    timings.forEach((timing) => {
      if (!timing.isClosed && timing.opensAt && timing.opensAt === timing.closesAt) {
        problems.push(`Opening hours for day ${timing.dayOfWeek}: opening and closing time are the same`);
      }
    });

    this.checkCovers(doc.media, problems);
    return problems;
  }

  private packageProblems(doc: PackageDocumentDto): string[] {
    const problems: string[] = [];

    if (doc.durationDays < doc.durationNights || doc.durationDays > doc.durationNights + 1) {
      problems.push('Days must equal nights or nights + 1 (for example 4N/5D)');
    }

    if (doc.maxPax != null && doc.minPax != null && doc.minPax > doc.maxPax) {
      problems.push('Minimum group size cannot exceed the maximum');
    }

    const months = doc.availableMonths ?? [];
    if (new Set(months).size !== months.length) {
      problems.push('Each available month can appear only once');
    }

    if (doc.route?.length) {
      const routeNights = doc.route.reduce((sum, stop) => sum + stop.nights, 0);

      if (routeNights !== doc.durationNights) {
        problems.push(`Route nights add up to ${routeNights}, but the package is ${doc.durationNights} nights`);
      }
    }

    const tiers = doc.tiers ?? [];
    const levels = new Set(tiers.map((tier) => tier.level));
    if (levels.size !== tiers.length) {
      problems.push('Each tier level can appear only once');
    }

    tiers.forEach((tier) => {
      if (tier.compareAtPrice != null && tier.compareAtPrice <= tier.pricePerPerson) {
        problems.push(`${tier.level}: the "was" price must be higher than the price`);
      }
    });

    if (doc.days?.length) {
      const numbers = [...doc.days.map((day) => day.dayNumber)].sort((a, b) => a - b);
      const expected = Array.from({ length: doc.durationDays }, (_, index) => index + 1);

      if (JSON.stringify(numbers) !== JSON.stringify(expected)) {
        problems.push(`Itinerary must have exactly one entry for each day 1–${doc.durationDays}`);
      }
    }

    if (doc.stays?.length) {
      if (doc.tiers) {
        doc.stays
          .filter((stay) => !levels.has(stay.tierLevel))
          .forEach((stay) => problems.push(`Stay at ${stay.hotelName} is for tier ${stay.tierLevel}, which the package does not offer`));
      }

      const routeSlugs = new Set((doc.route ?? []).map((stop) => stop.destinationSlug));
      if (doc.route) {
        doc.stays
          .filter((stay) => !routeSlugs.has(stay.destinationSlug))
          .forEach((stay) => problems.push(`Stay at ${stay.hotelName} is in ${stay.destinationSlug}, which is not on the route`));
      }

      const nightsByTier = new Map<string, number>();
      doc.stays.forEach((stay) => nightsByTier.set(stay.tierLevel, (nightsByTier.get(stay.tierLevel) ?? 0) + stay.nights));
      nightsByTier.forEach((nights, tier) => {
        if (nights !== doc.durationNights) {
          problems.push(`${tier} stays cover ${nights} nights, but the package is ${doc.durationNights} nights`);
        }
      });
    }

    const policies = doc.policies ?? [];
    if (new Set(policies.map((policy) => policy.kind)).size !== policies.length) {
      problems.push('Each policy type can appear only once');
    }

    this.checkCovers(doc.media, problems);
    return problems;
  }

  private checkCovers(media: MediaRefDto[] | undefined, problems: string[]): void {
    if ((media ?? []).filter((ref) => ref.isCover).length > 1) {
      problems.push('Only one image can be the cover');
    }
  }

  private async resolveTags(tx: Tx, slugs: string[], problems: string[]): Promise<string[]> {
    const unique = [...new Set(slugs)];
    const tags = await tx.tag.findMany({ where: { slug: { in: unique } }, select: { id: true, slug: true } });
    const found = new Set(tags.map((tag) => tag.slug));
    unique
      .filter((slug) => !found.has(slug))
      .forEach((slug) => problems.push(`Unknown tag '${slug}'`));

    return tags.map((tag) => tag.id);
  }

  private async resolveMedia(
    tx: Tx,
    refs: MediaRefDto[],
    problems: string[],
    actorId?: string
  ): Promise<ResolvedMedia[]> {
    const resolved: ResolvedMedia[] = [];
    const hasExplicitCover = refs.some((ref) => ref.isCover);

    for (const [index, ref] of refs.entries()) {
      let mediaId: string | undefined;

      if (ref.mediaId) {
        const media = await tx.media.findUnique({ where: { id: ref.mediaId }, select: { id: true } });
        mediaId = media?.id;

        if (!mediaId) {
          problems.push(`Image #${index + 1}: media '${ref.mediaId}' does not exist`);
        }
      } else if (ref.url) {
        const existing = await tx.media.findFirst({ where: { url: ref.url }, select: { id: true } });
        mediaId =
          existing?.id ??
          (
            await tx.media.create({
              data: {
                url: ref.url,
                sourceUrl: ref.url,
                altText: ref.altText!.trim(),
                credit: ref.credit ?? null,
                license: ref.license!,
                uploadedById: actorId ?? null
              },
              select: { id: true }
            })
          ).id;
      }

      if (mediaId) {
        resolved.push({ mediaId, isCover: hasExplicitCover ? Boolean(ref.isCover) : index === 0 });
      }
    }

    return resolved;
  }

  private async replaceAttachments(
    tx: Tx,
    owner: { destinationId: string } | { placeId: string } | { collectionId: string } | { packageId: string },
    media: ResolvedMedia[]
  ): Promise<void> {
    await tx.mediaAttachment.deleteMany({ where: owner });
    await tx.mediaAttachment.createMany({
      data: media.map((entry, index) => ({
        ...owner,
        mediaId: entry.mediaId,
        isCover: entry.isCover,
        sortOrder: index
      }))
    });
  }

  private async resolveDestination(
    tx: Tx,
    doc: PlaceDocumentDto,
    problems: string[]
  ): Promise<{ id: string; slug: string } | null> {
    const destination = await tx.destination.findFirst({
      where: doc.destinationId ? { id: doc.destinationId } : { slug: doc.destinationSlug },
      select: { id: true, slug: true }
    });

    if (!destination) {
      problems.push(`Destination '${doc.destinationId ?? doc.destinationSlug}' does not exist`);
    }

    return destination;
  }

  private async resolveCollectionItems(
    tx: Tx,
    items: NonNullable<CollectionDocumentDto['items']>,
    problems: string[]
  ): Promise<Array<{ destinationId: string | null; placeId: string | null; blurb: string | null }>> {
    const resolved: Array<{ destinationId: string | null; placeId: string | null; blurb: string | null }> = [];

    for (const [index, item] of items.entries()) {
      const label = `Item #${index + 1}`;

      if (item.placeId || item.placeSlug) {
        const place = await tx.place.findFirst({
          where: item.placeId
            ? { id: item.placeId }
            : { slug: item.placeSlug, destination: { slug: item.destinationSlug } },
          select: { id: true }
        });

        if (place) {
          resolved.push({ destinationId: null, placeId: place.id, blurb: item.blurb ?? null });
        } else {
          problems.push(`${label}: place '${item.placeId ?? `${item.destinationSlug}/${item.placeSlug}`}' does not exist`);
        }
        continue;
      }

      const destination = await tx.destination.findFirst({
        where: item.destinationId ? { id: item.destinationId } : { slug: item.destinationSlug },
        select: { id: true }
      });

      if (destination) {
        resolved.push({ destinationId: destination.id, placeId: null, blurb: item.blurb ?? null });
      } else {
        problems.push(`${label}: destination '${item.destinationId ?? item.destinationSlug}' does not exist`);
      }
    }

    const keys = resolved.map((item) => item.placeId ?? item.destinationId);
    if (new Set(keys).size !== keys.length) {
      problems.push('A destination or place can appear only once in a collection');
    }

    return resolved;
  }

  private async assertSlugFree(
    tx: Tx,
    entity: 'tag' | 'destination' | 'collection' | 'package',
    slug: string,
    exceptId?: string
  ): Promise<void> {
    const where = { slug, ...(exceptId ? { id: { not: exceptId } } : {}) };
    const clash =
      entity === 'tag'
        ? await tx.tag.findFirst({ where, select: { id: true } })
        : entity === 'destination'
          ? await tx.destination.findFirst({ where, select: { id: true } })
          : entity === 'package'
            ? await tx.package.findFirst({ where, select: { id: true } })
            : await tx.collection.findFirst({ where, select: { id: true } });

    if (clash) {
      throw new ConflictException(`A ${entity} with slug '${slug}' already exists`);
    }
  }

  private async recordRedirect(
    tx: Tx,
    entityType: string,
    scope: string,
    fromSlug: string,
    toSlug: string
  ): Promise<void> {
    // The new slug now resolves directly; drop any redirect that pointed away from it.
    await tx.slugRedirect.deleteMany({ where: { entityType, scope, fromSlug: toSlug } });
    // Keep chains short: anything that redirected to the old slug now goes straight to the new one.
    await tx.slugRedirect.updateMany({ where: { entityType, scope, toSlug: fromSlug }, data: { toSlug } });
    await tx.slugRedirect.upsert({
      where: { entityType_scope_fromSlug: { entityType, scope, fromSlug } },
      update: { toSlug },
      create: { entityType, scope, fromSlug, toSlug }
    });
  }

  private exportMediaRef(attachment: {
    isCover: boolean;
    media: { id: string; url: string; storageKey: string | null; altText: string; credit: string | null; license: string };
  }): ExportedMediaRef & MediaRefDto {
    return {
      mediaId: attachment.media.id,
      url: mediaUrl(attachment.media),
      altText: attachment.media.altText,
      credit: attachment.media.credit,
      license: attachment.media.license,
      isCover: attachment.isCover
    };
  }
}
