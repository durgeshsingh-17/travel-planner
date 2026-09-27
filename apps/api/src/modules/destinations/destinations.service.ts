import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { decimalToNumber } from '../../common/utils/number.util';
import { haversineKm } from '../../common/utils/geo.util';
import { openState } from '../../common/utils/india-time.util';
import { PackagesService } from '../packages/packages.service';
import { PrismaService } from '../../database/prisma.service';
import {
  ListDestinationPlacesQueryDto,
  ListDestinationsQueryDto
} from './dto/list-destinations-query.dto';
import {
  Paginated,
  destinationCard,
  destinationCardInclude,
  imageView,
  mediaInclude,
  placeCard,
  placeCardInclude,
  placeRankOrder
} from '../content/shared/content-views';

const DEFAULT_PAGE_SIZE = 24;

/** Either the content, or the slug it moved to. */
export type Resolved<T> = { redirectTo: string } | { data: T };

@Injectable()
export class DestinationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly packages: PackagesService
  ) {}

  async findAll(query: ListDestinationsQueryDto): Promise<Paginated<ReturnType<typeof destinationCard>>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? query.limit ?? DEFAULT_PAGE_SIZE;
    const where = this.listWhere(query);

    const [total, destinations] = await this.prisma.$transaction([
      this.prisma.destination.count({ where }),
      this.prisma.destination.findMany({
        where,
        include: destinationCardInclude,
        orderBy:
          query.sort === 'name'
            ? [{ name: 'asc' }]
            : [{ isFeatured: 'desc' }, { popularityScore: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return { items: destinations.map(destinationCard), page, pageSize, total };
  }

  /** Counts for the explore filters, over all published destinations. */
  async facets() {
    const published = { status: 'PUBLISHED' } satisfies Prisma.DestinationWhereInput;
    const [states, tags, months] = await Promise.all([
      this.prisma.destination.groupBy({
        by: ['state'],
        where: published,
        _count: { _all: true },
        orderBy: { state: 'asc' }
      }),
      this.prisma.tag.findMany({
        select: {
          slug: true,
          name: true,
          kind: true,
          _count: { select: { destinations: { where: { destination: published } } } }
        },
        orderBy: { name: 'asc' }
      }),
      this.prisma.destinationMonthInfo.groupBy({
        by: ['month'],
        where: { rating: 'GOOD', destination: published },
        _count: { _all: true },
        orderBy: { month: 'asc' }
      })
    ]);

    return {
      states: states.map((entry) => ({ value: entry.state, count: entry._count._all })),
      tags: tags
        .filter((tag) => tag._count.destinations > 0)
        .map((tag) => ({ slug: tag.slug, name: tag.name, kind: tag.kind, count: tag._count.destinations })),
      months: months.map((entry) => ({ month: entry.month, count: entry._count._all }))
    };
  }

  async findBySlug(slug: string): Promise<Resolved<unknown>> {
    const destination = await this.prisma.destination.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: {
        media: mediaInclude,
        tags: { include: { tag: { select: { slug: true, name: true, kind: true } } } },
        months: { orderBy: { month: 'asc' } },
        howToReach: { orderBy: { sortOrder: 'asc' } },
        faqs: { orderBy: { sortOrder: 'asc' } }
      }
    });

    if (!destination) {
      return this.redirectOrThrow('DESTINATION', '', slug, `Destination '${slug}' was not found`);
    }

    const publishedPlaces = { destinationId: destination.id, status: 'PUBLISHED' } as const;
    const [places, placeCount, similar, packages, reviews] = await Promise.all([
      this.prisma.place.findMany({
        where: publishedPlaces,
        include: placeCardInclude,
        orderBy: placeRankOrder,
        take: 12
      }),
      this.prisma.place.count({ where: publishedPlaces }),
      this.similarDestinations(destination.id, destination.state, destination.tags.map((entry) => entry.tagId)),
      this.packages.forDestination(destination.id),
      this.reviewSummary({ destinationId: destination.id })
    ]);
    const gallery = destination.media.map(imageView);
    const cover = destination.media.find((attachment) => attachment.isCover) ?? destination.media[0];

    return {
      data: {
        id: destination.id,
        slug: destination.slug,
        name: destination.name,
        state: destination.state,
        country: destination.country,
        latitude: decimalToNumber(destination.latitude),
        longitude: decimalToNumber(destination.longitude),
        tagline: destination.tagline,
        shortDescription: destination.shortDescription,
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
        seoTitle: destination.seoTitle,
        seoDescription: destination.seoDescription,
        updatedAt: destination.updatedAt.toISOString(),
        cover: cover
          ? imageView(cover)
          : destination.heroImageUrl
            ? { url: destination.heroImageUrl, altText: destination.name, width: null, height: null, credit: null, license: 'LICENSED' }
            : null,
        gallery,
        tags: destination.tags.map((entry) => entry.tag),
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
        places: places.map(placeCard),
        placeCount,
        similar,
        packages,
        reviewSummary: reviews
      }
    };
  }

  async findPlaces(slug: string, query: ListDestinationPlacesQueryDto) {
    const destination = await this.prisma.destination.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: { id: true, slug: true, name: true }
    });

    if (!destination) {
      throw new NotFoundException(`Destination '${slug}' was not found`);
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.PlaceWhereInput = {
      destinationId: destination.id,
      status: 'PUBLISHED',
      category: query.category,
      tags: query.tag ? { some: { tag: { slug: query.tag } } } : undefined
    };
    const [total, places] = await this.prisma.$transaction([
      this.prisma.place.count({ where }),
      this.prisma.place.findMany({
        where,
        include: placeCardInclude,
        orderBy: placeRankOrder,
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return { destination, items: places.map(placeCard), page, pageSize, total };
  }

  async findPlace(destinationSlug: string, placeSlug: string, now = new Date()): Promise<Resolved<unknown>> {
    const place = await this.prisma.place.findFirst({
      where: {
        slug: placeSlug,
        status: 'PUBLISHED',
        destination: { slug: destinationSlug, status: 'PUBLISHED' }
      },
      include: {
        destination: { select: { id: true, slug: true, name: true, state: true } },
        media: mediaInclude,
        tags: { include: { tag: { select: { slug: true, name: true, kind: true } } } },
        timings: { orderBy: { dayOfWeek: 'asc' } },
        faqs: { orderBy: { sortOrder: 'asc' } }
      }
    });

    if (!place) {
      return this.placeRedirectOrThrow(destinationSlug, placeSlug);
    }

    const [placeCount, nearby] = await Promise.all([
      this.prisma.place.count({ where: { destinationId: place.destinationId, status: 'PUBLISHED' } }),
      this.nearbyPlaces(place.id, decimalToNumber(place.latitude) ?? 0, decimalToNumber(place.longitude) ?? 0)
    ]);

    return {
      data: {
        id: place.id,
        slug: place.slug,
        name: place.name,
        category: place.category,
        description: place.description,
        overview: place.overview,
        latitude: decimalToNumber(place.latitude),
        longitude: decimalToNumber(place.longitude),
        rankInDestination: place.rankInDestination,
        placeCount,
        rating: decimalToNumber(place.rating),
        timeRequiredMinMinutes: place.timeRequiredMinMinutes ?? place.averageVisitMinutes,
        timeRequiredMaxMinutes: place.timeRequiredMaxMinutes,
        isFree: place.isFree,
        entryFeeIndian: decimalToNumber(place.entryFeeIndian),
        entryFeeChild: decimalToNumber(place.entryFeeChild),
        entryFeeForeigner: decimalToNumber(place.entryFeeForeigner),
        feeNotes: place.feeNotes,
        bestTimeOfDay: place.bestTimeOfDay,
        tips: place.tips,
        address: place.address,
        seoTitle: place.seoTitle,
        seoDescription: place.seoDescription,
        updatedAt: place.updatedAt.toISOString(),
        destination: place.destination,
        gallery: place.media.map(imageView),
        tags: place.tags.map((entry) => entry.tag),
        timings: place.timings.map((timing) => ({
          dayOfWeek: timing.dayOfWeek,
          opensAt: timing.opensAt,
          closesAt: timing.closesAt,
          isClosed: timing.isClosed
        })),
        openNow: openState(place.timings, now),
        reviewSummary: await this.reviewSummary({ placeId: place.id }),
        faqs: place.faqs.map((faq) => ({ question: faq.question, answer: faq.answer })),
        nearby
      }
    };
  }

  private async reviewSummary(where: { destinationId: string } | { placeId: string }) {
    const result = await this.prisma.review.aggregate({
      where: { ...where, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { _all: true }
    });

    return {
      average: result._avg.rating ? Math.round(result._avg.rating * 10) / 10 : null,
      count: result._count._all
    };
  }

  private listWhere(query: ListDestinationsQueryDto): Prisma.DestinationWhereInput {
    const q = query.q?.trim();

    return {
      status: 'PUBLISHED',
      state: query.state ? { equals: query.state, mode: 'insensitive' } : undefined,
      OR: q
        ? [
            { name: { contains: q, mode: 'insensitive' } },
            { state: { contains: q, mode: 'insensitive' } },
            { tagline: { contains: q, mode: 'insensitive' } }
          ]
        : undefined,
      tags: query.tag?.length ? { some: { tag: { slug: { in: query.tag } } } } : undefined,
      months: query.month ? { some: { month: query.month, rating: 'GOOD' } } : undefined,
      AND: [
        ...(query.days
          ? [
              { OR: [{ idealDaysMin: null }, { idealDaysMin: { lte: query.days } }] },
              { OR: [{ idealDaysMax: null }, { idealDaysMax: { gte: query.days } }] }
            ]
          : []),
        ...(query.budgetMax !== undefined ? [{ budgetPerDayMin: { lte: query.budgetMax } }] : [])
      ]
    };
  }

  /** Shared themes count most; same state breaks ties. */
  private async similarDestinations(id: string, state: string, tagIds: string[]) {
    const candidates = await this.prisma.destination.findMany({
      where: {
        status: 'PUBLISHED',
        id: { not: id },
        OR: [{ state }, ...(tagIds.length ? [{ tags: { some: { tagId: { in: tagIds } } } }] : [])]
      },
      include: { ...destinationCardInclude, tags: { include: { tag: { select: { slug: true, name: true, kind: true } } } } },
      take: 60
    });
    const wanted = new Set(tagIds);

    return candidates
      .map((candidate) => ({
        candidate,
        score:
          candidate.tags.filter((entry) => wanted.has(entry.tagId)).length * 2 +
          (candidate.state === state ? 1 : 0) +
          candidate.popularityScore / 1_000_000
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ candidate }) => destinationCard(candidate));
  }

  private async nearbyPlaces(placeId: string, latitude: number, longitude: number) {
    const radiusDegrees = 0.3;
    const candidates = await this.prisma.place.findMany({
      where: {
        id: { not: placeId },
        status: 'PUBLISHED',
        destination: { status: 'PUBLISHED' },
        latitude: { gte: latitude - radiusDegrees, lte: latitude + radiusDegrees },
        longitude: { gte: longitude - radiusDegrees, lte: longitude + radiusDegrees }
      },
      include: placeCardInclude,
      take: 50
    });

    return candidates
      .map((candidate) => ({
        ...placeCard(candidate),
        distanceKm:
          Math.round(
            haversineKm(latitude, longitude, decimalToNumber(candidate.latitude) ?? 0, decimalToNumber(candidate.longitude) ?? 0) * 10
          ) / 10
      }))
      .filter((candidate) => candidate.distanceKm <= 30)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 6);
  }

  private async redirectOrThrow(
    entityType: string,
    scope: string,
    slug: string,
    message: string
  ): Promise<{ redirectTo: string }> {
    const redirect = await this.prisma.slugRedirect.findUnique({
      where: { entityType_scope_fromSlug: { entityType, scope, fromSlug: slug } }
    });

    if (!redirect) {
      throw new NotFoundException(message);
    }

    return { redirectTo: redirect.toSlug };
  }

  private async placeRedirectOrThrow(destinationSlug: string, placeSlug: string) {
    const destinationMove = await this.prisma.slugRedirect.findUnique({
      where: {
        entityType_scope_fromSlug: { entityType: 'DESTINATION', scope: '', fromSlug: destinationSlug }
      }
    });
    const currentDestinationSlug = destinationMove?.toSlug ?? destinationSlug;
    const placeMove = await this.prisma.slugRedirect.findUnique({
      where: {
        entityType_scope_fromSlug: { entityType: 'PLACE', scope: currentDestinationSlug, fromSlug: placeSlug }
      }
    });

    if (!destinationMove && !placeMove) {
      throw new NotFoundException(`Place '${destinationSlug}/${placeSlug}' was not found`);
    }

    return { redirectTo: `${currentDestinationSlug}/places/${placeMove?.toSlug ?? placeSlug}` };
  }
}
