/**
 * Editorial quality rules. Errors block publishing; warnings lower the
 * content-health score shown in admin but do not block.
 */
export interface ContentCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: 'error' | 'warning';
}

export interface ContentHealth {
  score: number;
  canPublish: boolean;
  errors: string[];
  warnings: string[];
  checks: ContentCheck[];
}

function wordCount(text?: string | null): number {
  return text?.trim() ? text.trim().split(/\s+/).length : 0;
}

function summarize(checks: ContentCheck[]): ContentHealth {
  const failed = checks.filter((check) => !check.passed);

  return {
    score: checks.length
      ? Math.round((checks.filter((check) => check.passed).length / checks.length) * 100)
      : 100,
    canPublish: failed.every((check) => check.severity !== 'error'),
    errors: failed.filter((check) => check.severity === 'error').map((check) => check.label),
    warnings: failed.filter((check) => check.severity === 'warning').map((check) => check.label),
    checks
  };
}

export interface DestinationSnapshot {
  shortDescription: string;
  overview?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  idealDaysMin?: number | null;
  nearestAirport?: string | null;
  nearestRailway?: string | null;
  imageCount: number;
  hasCover: boolean;
  monthCount: number;
  howToReachCount: number;
  faqCount: number;
  tagCount: number;
  publishedPlaceCount: number;
}

export function destinationHealth(snapshot: DestinationSnapshot): ContentHealth {
  return summarize([
    {
      id: 'short-description',
      label: 'Short description of at least 20 characters',
      passed: snapshot.shortDescription.trim().length >= 20,
      severity: 'error'
    },
    {
      id: 'overview',
      label: 'Overview of at least 150 words',
      passed: wordCount(snapshot.overview) >= 150,
      severity: 'warning'
    },
    { id: 'cover', label: 'A cover image', passed: snapshot.hasCover, severity: 'warning' },
    {
      id: 'gallery',
      label: 'At least 3 images',
      passed: snapshot.imageCount >= 3,
      severity: 'warning'
    },
    {
      id: 'months',
      label: 'Best-time data for all 12 months',
      passed: snapshot.monthCount === 12,
      severity: 'warning'
    },
    {
      id: 'reach',
      label: 'At least 2 ways to reach',
      passed: snapshot.howToReachCount >= 2,
      severity: 'warning'
    },
    { id: 'faqs', label: 'At least 4 FAQs', passed: snapshot.faqCount >= 4, severity: 'warning' },
    { id: 'tags', label: 'At least 2 tags', passed: snapshot.tagCount >= 2, severity: 'warning' },
    {
      id: 'places',
      label: 'At least 5 published places',
      passed: snapshot.publishedPlaceCount >= 5,
      severity: 'warning'
    },
    {
      id: 'facts',
      label: 'Ideal duration and nearest airport or railhead',
      passed: Boolean(snapshot.idealDaysMin && (snapshot.nearestAirport || snapshot.nearestRailway)),
      severity: 'warning'
    },
    {
      id: 'seo',
      label: 'SEO title and description',
      passed: Boolean(snapshot.seoTitle && snapshot.seoDescription),
      severity: 'warning'
    }
  ]);
}

export interface PlaceSnapshot {
  description: string;
  overview?: string | null;
  destinationPublished: boolean;
  timingCount: number;
  isFree: boolean;
  entryFeeIndian?: number | null;
  feeNotes?: string | null;
  timeRequiredMinMinutes?: number | null;
  averageVisitMinutes?: number | null;
  imageCount: number;
  tagCount: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export function placeHealth(snapshot: PlaceSnapshot): ContentHealth {
  return summarize([
    {
      id: 'destination-published',
      label: 'Its destination is published',
      passed: snapshot.destinationPublished,
      severity: 'error'
    },
    {
      id: 'description',
      label: 'Description of at least 20 characters',
      passed: snapshot.description.trim().length >= 20,
      severity: 'error'
    },
    {
      id: 'overview',
      label: 'Overview of at least 80 words',
      passed: wordCount(snapshot.overview) >= 80,
      severity: 'warning'
    },
    {
      id: 'timings',
      label: 'Opening hours',
      passed: snapshot.timingCount > 0,
      severity: 'warning'
    },
    {
      id: 'fees',
      label: 'Entry fee, or marked free',
      passed: snapshot.isFree || snapshot.entryFeeIndian != null || Boolean(snapshot.feeNotes),
      severity: 'warning'
    },
    {
      id: 'time-required',
      label: 'Time required',
      passed: Boolean(snapshot.timeRequiredMinMinutes || snapshot.averageVisitMinutes),
      severity: 'warning'
    },
    { id: 'image', label: 'At least 1 image', passed: snapshot.imageCount >= 1, severity: 'warning' },
    { id: 'tags', label: 'At least 1 tag', passed: snapshot.tagCount >= 1, severity: 'warning' },
    {
      id: 'seo',
      label: 'SEO title and description',
      passed: Boolean(snapshot.seoTitle && snapshot.seoDescription),
      severity: 'warning'
    }
  ]);
}

export interface CollectionSnapshot {
  intro: string;
  publishedItemCount: number;
  hasCover: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export function collectionHealth(snapshot: CollectionSnapshot): ContentHealth {
  return summarize([
    {
      id: 'intro',
      label: 'Intro of at least 20 characters',
      passed: snapshot.intro.trim().length >= 20,
      severity: 'error'
    },
    {
      id: 'items',
      label: 'At least 1 published destination or place',
      passed: snapshot.publishedItemCount >= 1,
      severity: 'error'
    },
    {
      id: 'enough-items',
      label: 'At least 5 published items',
      passed: snapshot.publishedItemCount >= 5,
      severity: 'warning'
    },
    { id: 'cover', label: 'A cover image', passed: snapshot.hasCover, severity: 'warning' },
    {
      id: 'seo',
      label: 'SEO title and description',
      passed: Boolean(snapshot.seoTitle && snapshot.seoDescription),
      severity: 'warning'
    }
  ]);
}
