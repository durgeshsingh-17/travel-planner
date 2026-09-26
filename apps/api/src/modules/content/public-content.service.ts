import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TagKind } from '@prisma/client';

import { indiaClock } from '../../common/utils/india-time.util';
import { LocationsService } from '../locations/locations.service';
import { PrismaService } from '../../database/prisma.service';
import {
  coverInclude,
  coverView,
  destinationCard,
  destinationCardInclude,
  imageView,
  mediaInclude,
  placeCard,
  placeCardInclude
} from './shared/content-views';

const PUBLISHED = { status: 'PUBLISHED' } as const;

@Injectable()
export class PublicContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService
  ) {}

  async collections() {
    const collections = await this.prisma.collection.findMany({
      where: PUBLISHED,
      include: {
        media: coverInclude,
        _count: { select: { items: { where: this.publishedItem() } } }
      },
      orderBy: [{ isFeatured: 'desc' }, { title: 'asc' }]
    });

    return collections.map((collection) => this.collectionCard(collection));
  }

  async collection(slug: string) {
    const collection = await this.prisma.collection.findFirst({
      where: { slug, ...PUBLISHED },
      include: {
        media: mediaInclude,
        items: {
          where: this.publishedItem(),
          orderBy: { sortOrder: 'asc' },
          include: {
            destination: { include: destinationCardInclude },
            place: { include: placeCardInclude }
          }
        }
      }
    });

    if (!collection) {
      const redirect = await this.prisma.slugRedirect.findUnique({
        where: { entityType_scope_fromSlug: { entityType: 'COLLECTION', scope: '', fromSlug: slug } }
      });

      if (redirect) {
        return { redirectTo: redirect.toSlug };
      }

      throw new NotFoundException(`Collection '${slug}' was not found`);
    }

    return {
      data: {
        id: collection.id,
        slug: collection.slug,
        title: collection.title,
        intro: collection.intro,
        body: collection.body,
        seoTitle: collection.seoTitle,
        seoDescription: collection.seoDescription,
        updatedAt: collection.updatedAt.toISOString(),
        cover: coverView(collection.media),
        gallery: collection.media.map(imageView),
        items: collection.items.map((item) => ({
          blurb: item.blurb,
          destination: item.destination ? destinationCard(item.destination) : null,
          place: item.place ? placeCard(item.place) : null
        }))
      }
    };
  }

  async tags(kind?: TagKind) {
    const tags = await this.prisma.tag.findMany({
      where: { kind },
      select: {
        slug: true,
        name: true,
        kind: true,
        description: true,
        _count: { select: { destinations: { where: { destination: PUBLISHED } } } }
      },
      orderBy: { name: 'asc' }
    });

    return tags.map(({ _count, ...tag }) => ({ ...tag, destinationCount: _count.destinations }));
  }

  /** Grouped typeahead across the catalogue, for the global search box. */
  async suggest(rawQuery: string) {
    const q = rawQuery.trim();

    if (q.length < 2) {
      return { destinations: [], places: [], collections: [], locations: [] };
    }

    const contains = { contains: q, mode: 'insensitive' as const };
    const [destinations, places, collections, locationIds] = await Promise.all([
      this.prisma.destination.findMany({
        where: { ...PUBLISHED, OR: [{ name: contains }, { state: contains }] },
        select: { slug: true, name: true, state: true },
        orderBy: [{ popularityScore: 'desc' }, { name: 'asc' }],
        take: 5
      }),
      this.prisma.place.findMany({
        where: { ...PUBLISHED, destination: PUBLISHED, name: contains },
        select: { slug: true, name: true, category: true, destination: { select: { slug: true, name: true } } },
        orderBy: [{ rankInDestination: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
        take: 5
      }),
      this.prisma.collection.findMany({
        where: { ...PUBLISHED, title: contains },
        select: { slug: true, title: true },
        take: 3
      }),
      this.locations.searchIds(q, 5)
    ]);
    const locations = locationIds.length
      ? await this.prisma.location.findMany({
          where: { id: { in: locationIds } },
          select: { id: true, slug: true, name: true, state: true, aliases: true }
        })
      : [];

    return {
      destinations,
      places,
      collections,
      locations: locationIds
        .map((id) => locations.find((location) => location.id === id))
        .filter((location): location is NonNullable<typeof location> => Boolean(location))
    };
  }

  /** Everything the home page needs in one cacheable call. */
  async home(month = indiaClock().month) {
    const [featured, trending, collections, themes, stats] = await Promise.all([
      this.prisma.destination.findMany({
        where: PUBLISHED,
        include: destinationCardInclude,
        orderBy: [{ isFeatured: 'desc' }, { popularityScore: 'desc' }, { name: 'asc' }],
        take: 8
      }),
      this.prisma.destination.findMany({
        where: { ...PUBLISHED, months: { some: { month, rating: 'GOOD' } } },
        include: destinationCardInclude,
        orderBy: [{ popularityScore: 'desc' }, { name: 'asc' }],
        take: 8
      }),
      this.collections(),
      this.tags('THEME'),
      this.stats()
    ]);

    return {
      month,
      featured: featured.map(destinationCard),
      trending: trending.map(destinationCard),
      collections: collections.filter((collection) => collection.itemCount > 0).slice(0, 6),
      themes: themes.filter((theme) => theme.destinationCount > 0),
      stats
    };
  }

  /** Real counts only; the home page shows nothing rather than an invented number. */
  async stats() {
    const [destinations, places, collections, trips] = await Promise.all([
      this.prisma.destination.count({ where: PUBLISHED }),
      this.prisma.place.count({ where: { ...PUBLISHED, destination: PUBLISHED } }),
      this.prisma.collection.count({ where: PUBLISHED }),
      this.prisma.trip.count({ where: { status: { in: ['GENERATED', 'ACTIVE', 'COMPLETED'] } } })
    ]);

    return { destinations, places, collections, tripsPlanned: trips };
  }

  /** Paths and last-modified dates for every public, indexable page. */
  async sitemapEntries() {
    const [destinations, places, collections] = await Promise.all([
      this.prisma.destination.findMany({ where: PUBLISHED, select: { slug: true, updatedAt: true } }),
      this.prisma.place.findMany({
        where: { ...PUBLISHED, destination: PUBLISHED },
        select: { slug: true, updatedAt: true, destination: { select: { slug: true } } }
      }),
      this.prisma.collection.findMany({ where: PUBLISHED, select: { slug: true, updatedAt: true } })
    ]);
    const latest = [...destinations, ...places, ...collections]
      .map((entry) => entry.updatedAt)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return [
      { path: '/', lastmod: latest?.toISOString() ?? null },
      { path: '/destinations', lastmod: latest?.toISOString() ?? null },
      ...destinations.map((destination) => ({
        path: `/destinations/${destination.slug}`,
        lastmod: destination.updatedAt.toISOString()
      })),
      ...places.map((place) => ({
        path: `/destinations/${place.destination.slug}/places/${place.slug}`,
        lastmod: place.updatedAt.toISOString()
      })),
      ...collections.map((collection) => ({
        path: `/collections/${collection.slug}`,
        lastmod: collection.updatedAt.toISOString()
      }))
    ];
  }

  private publishedItem(): Prisma.CollectionItemWhereInput {
    return {
      OR: [
        { destination: PUBLISHED },
        { place: { ...PUBLISHED, destination: PUBLISHED } }
      ]
    };
  }

  private collectionCard(collection: Prisma.CollectionGetPayload<{
    include: { media: typeof coverInclude; _count: { select: { items: true } } };
  }>) {
    return {
      id: collection.id,
      slug: collection.slug,
      title: collection.title,
      intro: collection.intro,
      isFeatured: collection.isFeatured,
      cover: coverView(collection.media),
      itemCount: collection._count.items
    };
  }
}
