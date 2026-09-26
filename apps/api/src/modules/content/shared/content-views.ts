import { Prisma } from '@prisma/client';

import { decimalToNumber } from '../../../common/utils/number.util';
import { mediaUrl } from './media-url';

/** Prisma include for an ordered image list with its media rows. */
export const mediaInclude = {
  orderBy: { sortOrder: 'asc' },
  include: { media: true }
} satisfies Prisma.MediaAttachmentFindManyArgs;

export const coverInclude = {
  orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
  take: 1,
  include: { media: true }
} satisfies Prisma.MediaAttachmentFindManyArgs;

type AttachmentWithMedia = Prisma.MediaAttachmentGetPayload<{ include: { media: true } }>;

export interface ImageView {
  url: string;
  altText: string;
  width: number | null;
  height: number | null;
  credit: string | null;
  license: string;
}

export function imageView(attachment: AttachmentWithMedia): ImageView {
  return {
    url: mediaUrl(attachment.media),
    altText: attachment.media.altText,
    width: attachment.media.width,
    height: attachment.media.height,
    credit: attachment.media.credit,
    license: attachment.media.license
  };
}

/** Cover image: the flagged cover, else the first image, else the legacy hero URL. */
export function coverView(
  attachments: AttachmentWithMedia[],
  fallback?: { url: string | null; altText: string }
): ImageView | null {
  const cover = attachments.find((attachment) => attachment.isCover) ?? attachments[0];

  if (cover) {
    return imageView(cover);
  }

  return fallback?.url
    ? { url: fallback.url, altText: fallback.altText, width: null, height: null, credit: null, license: 'LICENSED' }
    : null;
}

export const destinationCardInclude = {
  media: coverInclude,
  tags: { include: { tag: { select: { slug: true, name: true, kind: true } } } },
  months: { where: { rating: 'GOOD' }, select: { month: true }, orderBy: { month: 'asc' } }
} satisfies Prisma.DestinationInclude;

type DestinationForCard = Prisma.DestinationGetPayload<{ include: typeof destinationCardInclude }>;

export function destinationCard(destination: DestinationForCard) {
  return {
    id: destination.id,
    slug: destination.slug,
    name: destination.name,
    state: destination.state,
    tagline: destination.tagline,
    shortDescription: destination.shortDescription,
    rating: decimalToNumber(destination.rating),
    idealDaysMin: destination.idealDaysMin,
    idealDaysMax: destination.idealDaysMax,
    budgetPerDayMin: destination.budgetPerDayMin,
    budgetPerDayMax: destination.budgetPerDayMax,
    bestTimeToVisit: destination.bestTimeToVisit,
    bestMonths: destination.months.map((month) => month.month),
    latitude: decimalToNumber(destination.latitude),
    longitude: decimalToNumber(destination.longitude),
    cover: coverView(destination.media, {
      url: destination.heroImageUrl,
      altText: destination.name
    }),
    tags: destination.tags.map((entry) => entry.tag)
  };
}

export const placeCardInclude = {
  media: coverInclude,
  tags: { include: { tag: { select: { slug: true, name: true, kind: true } } } },
  destination: { select: { slug: true, name: true } }
} satisfies Prisma.PlaceInclude;

type PlaceForCard = Prisma.PlaceGetPayload<{ include: typeof placeCardInclude }>;

export function placeCard(place: PlaceForCard) {
  return {
    id: place.id,
    slug: place.slug,
    name: place.name,
    category: place.category,
    description: place.description,
    rankInDestination: place.rankInDestination,
    rating: decimalToNumber(place.rating),
    timeRequiredMinMinutes: place.timeRequiredMinMinutes ?? place.averageVisitMinutes,
    timeRequiredMaxMinutes: place.timeRequiredMaxMinutes,
    isFree: place.isFree,
    entryFeeIndian: decimalToNumber(place.entryFeeIndian),
    latitude: decimalToNumber(place.latitude),
    longitude: decimalToNumber(place.longitude),
    destination: place.destination,
    cover: coverView(place.media),
    tags: place.tags.map((entry) => entry.tag)
  };
}

/** Published places first by editorial rank, then rating, then name. */
export const placeRankOrder: Prisma.PlaceOrderByWithRelationInput[] = [
  { rankInDestination: { sort: 'asc', nulls: 'last' } },
  { rating: { sort: 'desc', nulls: 'last' } },
  { name: 'asc' }
];

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
