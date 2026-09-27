import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ListPackagesQueryDto } from './dto/list-packages-query.dto';
import { PrismaService } from '../../database/prisma.service';
import { TIER_ORDER, packageCard, packageCardInclude } from './package-views';
import { decimalToNumber } from '../../common/utils/number.util';
import { imageView, mediaInclude } from '../content/shared/content-views';

const PUBLISHED = { status: 'PUBLISHED' } as const;
const DEFAULT_PAGE_SIZE = 24;

@Injectable()
export class PackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListPackagesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = this.listWhere(query);
    const [total, packages] = await this.prisma.$transaction([
      this.prisma.package.count({ where }),
      this.prisma.package.findMany({
        where,
        include: packageCardInclude,
        orderBy: this.orderBy(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return { items: packages.map(packageCard), page, pageSize, total };
  }

  /** Filter options with counts, over all published packages. */
  async facets() {
    const [stops, tags, bounds] = await Promise.all([
      this.prisma.packageDestination.findMany({
        where: { package: PUBLISHED },
        select: { packageId: true, destination: { select: { slug: true, name: true, state: true } } }
      }),
      this.prisma.tag.findMany({
        select: { slug: true, name: true, kind: true, _count: { select: { packages: { where: { package: PUBLISHED } } } } },
        orderBy: { name: 'asc' }
      }),
      this.prisma.package.aggregate({
        where: PUBLISHED,
        _min: { fromPrice: true, durationNights: true },
        _max: { fromPrice: true, durationNights: true }
      })
    ]);
    const destinations = new Map<string, { slug: string; name: string; state: string; packages: Set<string> }>();
    stops.forEach((stop) => {
      const entry = destinations.get(stop.destination.slug) ?? { ...stop.destination, packages: new Set<string>() };
      entry.packages.add(stop.packageId);
      destinations.set(stop.destination.slug, entry);
    });

    return {
      destinations: [...destinations.values()]
        .map(({ packages, ...destination }) => ({ ...destination, count: packages.size }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      tags: tags
        .filter((tag) => tag._count.packages > 0)
        .map((tag) => ({ slug: tag.slug, name: tag.name, kind: tag.kind, count: tag._count.packages })),
      price: { min: bounds._min.fromPrice, max: bounds._max.fromPrice },
      nights: { min: bounds._min.durationNights, max: bounds._max.durationNights }
    };
  }

  async findBySlug(slug: string): Promise<{ redirectTo: string } | { data: unknown }> {
    const pkg = await this.prisma.package.findFirst({
      where: { slug, ...PUBLISHED },
      include: {
        startLocation: { select: { slug: true, name: true, state: true } },
        destinations: {
          orderBy: { sortOrder: 'asc' },
          include: { destination: { select: { id: true, slug: true, name: true, state: true, status: true } } }
        },
        tiers: true,
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            overnightDestination: { select: { slug: true, name: true } },
            places: {
              orderBy: { sortOrder: 'asc' },
              include: {
                place: {
                  select: {
                    slug: true,
                    name: true,
                    category: true,
                    status: true,
                    destination: { select: { slug: true, status: true } }
                  }
                }
              }
            }
          }
        },
        stays: { orderBy: [{ tierLevel: 'asc' }, { sortOrder: 'asc' }], include: { destination: { select: { slug: true, name: true } } } },
        inclusions: { orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] },
        policies: true,
        tags: { include: { tag: { select: { slug: true, name: true, kind: true } } } },
        faqs: { orderBy: { sortOrder: 'asc' } },
        media: mediaInclude
      }
    });

    if (!pkg) {
      const redirect = await this.prisma.slugRedirect.findUnique({
        where: { entityType_scope_fromSlug: { entityType: 'PACKAGE', scope: '', fromSlug: slug } }
      });

      if (redirect) {
        return { redirectTo: redirect.toSlug };
      }

      throw new NotFoundException(`Package '${slug}' was not found`);
    }

    const [reviews, similar] = await Promise.all([
      this.prisma.review.aggregate({
        where: { packageId: pkg.id, status: 'APPROVED' },
        _avg: { rating: true },
        _count: { _all: true }
      }),
      this.similar(pkg.id, pkg.destinations.map((stop) => stop.destinationId), pkg.tags.map((entry) => entry.tagId))
    ]);
    const tiers = [...pkg.tiers].sort((a, b) => TIER_ORDER.indexOf(a.level) - TIER_ORDER.indexOf(b.level));

    return {
      data: {
        id: pkg.id,
        slug: pkg.slug,
        title: pkg.title,
        summary: pkg.summary,
        overview: pkg.overview,
        durationDays: pkg.durationDays,
        durationNights: pkg.durationNights,
        fromPrice: pkg.fromPrice,
        priceBasis: pkg.priceBasis,
        availableMonths: pkg.availableMonths,
        minPax: pkg.minPax,
        maxPax: pkg.maxPax,
        isCustomizable: pkg.isCustomizable,
        seoTitle: pkg.seoTitle,
        seoDescription: pkg.seoDescription,
        updatedAt: pkg.updatedAt.toISOString(),
        startLocation: pkg.startLocation,
        route: pkg.destinations.map((stop) => ({
          slug: stop.destination.slug,
          name: stop.destination.name,
          state: stop.destination.state,
          nights: stop.nights,
          // Link only to guides that are live.
          hasGuide: stop.destination.status === 'PUBLISHED'
        })),
        tiers: tiers.map((tier) => ({
          level: tier.level,
          pricePerPerson: tier.pricePerPerson,
          compareAtPrice: tier.compareAtPrice,
          childPrice: tier.childPrice,
          singleSupplement: tier.singleSupplement,
          taxesIncluded: tier.taxesIncluded,
          hotelCategory: tier.hotelCategory,
          transportNote: tier.transportNote,
          stays: pkg.stays
            .filter((stay) => stay.tierLevel === tier.level)
            .map((stay) => ({
              destination: stay.destination,
              nights: stay.nights,
              hotelName: stay.hotelName,
              orSimilar: stay.orSimilar,
              hotelCategory: stay.hotelCategory,
              roomType: stay.roomType,
              mealPlan: stay.mealPlan
            }))
        })),
        days: pkg.days.map((day) => ({
          dayNumber: day.dayNumber,
          title: day.title,
          description: day.description,
          overnight: day.overnightDestination,
          mealsIncluded: day.mealsIncluded,
          places: day.places.map((entry) => ({
            slug: entry.place.slug,
            name: entry.place.name,
            category: entry.place.category,
            destinationSlug: entry.place.destination.slug,
            hasPage: entry.place.status === 'PUBLISHED' && entry.place.destination.status === 'PUBLISHED'
          }))
        })),
        inclusions: pkg.inclusions.filter((entry) => entry.type === 'INCLUSION').map((entry) => entry.text),
        exclusions: pkg.inclusions.filter((entry) => entry.type === 'EXCLUSION').map((entry) => entry.text),
        policies: pkg.policies.map((policy) => ({ kind: policy.kind, body: policy.body })),
        faqs: pkg.faqs.map((faq) => ({ question: faq.question, answer: faq.answer })),
        tags: pkg.tags.map((entry) => entry.tag),
        gallery: pkg.media.map(imageView),
        reviewSummary: {
          average: reviews._avg.rating ? Math.round(reviews._avg.rating * 10) / 10 : null,
          count: reviews._count._all
        },
        rating: decimalToNumber(pkg.rating),
        similar
      }
    };
  }

  /** Published packages that visit a destination, for destination pages. */
  async forDestination(destinationId: string, take = 4) {
    const packages = await this.prisma.package.findMany({
      where: { ...PUBLISHED, destinations: { some: { destinationId } } },
      include: packageCardInclude,
      orderBy: this.orderBy('popular'),
      take
    });

    return packages.map(packageCard);
  }

  private async similar(id: string, destinationIds: string[], tagIds: string[]) {
    const candidates = await this.prisma.package.findMany({
      where: {
        ...PUBLISHED,
        id: { not: id },
        OR: [
          { destinations: { some: { destinationId: { in: destinationIds } } } },
          ...(tagIds.length ? [{ tags: { some: { tagId: { in: tagIds } } } }] : [])
        ]
      },
      include: {
        ...packageCardInclude,
        destinations: { orderBy: { sortOrder: 'asc' }, include: { destination: { select: { id: true, slug: true, name: true, state: true } } } },
        tags: { include: { tag: { select: { id: true, slug: true, name: true, kind: true } } } }
      },
      take: 40
    });
    const wantedDestinations = new Set(destinationIds);
    const wantedTags = new Set(tagIds);

    return candidates
      .map((candidate) => ({
        candidate,
        score:
          candidate.destinations.filter((stop) => wantedDestinations.has(stop.destinationId)).length * 3 +
          candidate.tags.filter((entry) => wantedTags.has(entry.tagId)).length +
          candidate.popularityScore / 1_000_000
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ candidate }) => packageCard(candidate));
  }

  private listWhere(query: ListPackagesQueryDto): Prisma.PackageWhereInput {
    const q = query.q?.trim();
    const and: Prisma.PackageWhereInput[] = [];

    if (query.month) {
      and.push({ OR: [{ availableMonths: { isEmpty: true } }, { availableMonths: { has: query.month } }] });
    }

    if (query.priceMin !== undefined) and.push({ fromPrice: { gte: query.priceMin } });
    if (query.priceMax !== undefined) and.push({ fromPrice: { lte: query.priceMax } });
    if (query.nightsMin !== undefined) and.push({ durationNights: { gte: query.nightsMin } });
    if (query.nightsMax !== undefined) and.push({ durationNights: { lte: query.nightsMax } });
    if (query.destination) and.push({ destinations: { some: { destination: { slug: query.destination } } } });
    if (query.state) {
      and.push({ destinations: { some: { destination: { state: { equals: query.state, mode: 'insensitive' } } } } });
    }
    if (query.tag?.length) and.push({ tags: { some: { tag: { slug: { in: query.tag } } } } });
    if (query.tier) and.push({ tiers: { some: { level: query.tier } } });
    if (q) {
      and.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { destinations: { some: { destination: { name: { contains: q, mode: 'insensitive' } } } } }
        ]
      });
    }

    return { ...PUBLISHED, fromPrice: { not: null }, AND: and };
  }

  private orderBy(sort: ListPackagesQueryDto['sort']): Prisma.PackageOrderByWithRelationInput[] {
    switch (sort) {
      case 'price_asc':
        return [{ fromPrice: { sort: 'asc', nulls: 'last' } }, { title: 'asc' }];
      case 'price_desc':
        return [{ fromPrice: { sort: 'desc', nulls: 'last' } }, { title: 'asc' }];
      case 'duration':
        return [{ durationNights: 'asc' }, { fromPrice: 'asc' }];
      case 'rating':
        return [{ rating: { sort: 'desc', nulls: 'last' } }, { reviewCount: 'desc' }];
      default:
        return [{ isFeatured: 'desc' }, { popularityScore: 'desc' }, { title: 'asc' }];
    }
  }
}
