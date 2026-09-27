import { Prisma } from '@prisma/client';

import { coverInclude, coverView } from '../content/shared/content-views';
import { decimalToNumber } from '../../common/utils/number.util';

export const TIER_ORDER = ['BUDGET', 'MID_RANGE', 'PREMIUM', 'LUXURY'] as const;

export const packageCardInclude = {
  destinations: {
    orderBy: { sortOrder: 'asc' },
    include: { destination: { select: { slug: true, name: true, state: true } } }
  },
  tiers: { select: { level: true, pricePerPerson: true, compareAtPrice: true } },
  media: coverInclude,
  tags: { include: { tag: { select: { slug: true, name: true, kind: true } } } },
  inclusions: { where: { type: 'INCLUSION' }, orderBy: { sortOrder: 'asc' }, take: 4, select: { text: true } }
} satisfies Prisma.PackageInclude;

type PackageForCard = Prisma.PackageGetPayload<{ include: typeof packageCardInclude }>;

export function packageCard(pkg: PackageForCard) {
  const cheapest = [...pkg.tiers].sort((a, b) => a.pricePerPerson - b.pricePerPerson)[0];

  return {
    id: pkg.id,
    slug: pkg.slug,
    title: pkg.title,
    summary: pkg.summary,
    durationDays: pkg.durationDays,
    durationNights: pkg.durationNights,
    fromPrice: pkg.fromPrice,
    // Only a real earlier price is shown as a strike-through.
    compareAtPrice: cheapest?.compareAtPrice ?? null,
    priceBasis: pkg.priceBasis,
    rating: decimalToNumber(pkg.rating),
    reviewCount: pkg.reviewCount,
    route: pkg.destinations.map((stop) => ({
      slug: stop.destination.slug,
      name: stop.destination.name,
      state: stop.destination.state,
      nights: stop.nights
    })),
    tiers: [...pkg.tiers]
      .sort((a, b) => TIER_ORDER.indexOf(a.level) - TIER_ORDER.indexOf(b.level))
      .map((tier) => tier.level),
    highlights: pkg.inclusions.map((entry) => entry.text),
    cover: coverView(pkg.media),
    tags: pkg.tags.map((entry) => entry.tag)
  };
}

export type PackageCardView = ReturnType<typeof packageCard>;
