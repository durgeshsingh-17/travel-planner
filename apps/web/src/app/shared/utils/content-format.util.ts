export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export function formatInr(value: number): string {
  return inr.format(value);
}

/** "₹1,500–₹4,500", "from ₹1,500", or null when unknown. */
export function inrRange(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min != null && max != null) {
    return min === max ? formatInr(min) : `${formatInr(min)}–${formatInr(max)}`;
  }

  if (min != null) return `from ${formatInr(min)}`;
  if (max != null) return `up to ${formatInr(max)}`;
  return null;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** "1–2 h", "45 min", or null when unknown. */
export function durationRange(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min && max && max !== min) {
    return max <= 60 ? `${min}–${max} min` : `${formatMinutes(min)} – ${formatMinutes(max)}`;
  }

  return min ? formatMinutes(min) : max ? `up to ${formatMinutes(max)}` : null;
}

export function dayRange(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min && max && max !== min) return `${min}–${max} days`;
  const days = min ?? max;
  return days ? `${days} day${days === 1 ? '' : 's'}` : null;
}

/** Collapses a list of month numbers into readable ranges: [10,11,12,1,2] → "Oct–Feb". */
export function monthRanges(months: number[]): string | null {
  if (!months.length) return null;
  const set = new Set(months);
  if (set.size === 12) return 'All year';

  const short = (month: number) => MONTH_NAMES[month - 1].slice(0, 3);
  // Start from a month whose predecessor is not included, so ranges can wrap over December.
  const start = [...set].sort((a, b) => a - b).find((month) => !set.has(month === 1 ? 12 : month - 1)) ?? 1;
  const ranges: string[] = [];
  let rangeStart: number | null = null;
  let previous: number | null = null;

  for (let step = 0; step < 12; step += 1) {
    const month = ((start - 1 + step) % 12) + 1;

    if (set.has(month)) {
      rangeStart ??= month;
      previous = month;
    } else if (rangeStart !== null && previous !== null) {
      ranges.push(rangeStart === previous ? short(rangeStart) : `${short(rangeStart)}–${short(previous)}`);
      rangeStart = null;
    }
  }

  if (rangeStart !== null && previous !== null) {
    ranges.push(rangeStart === previous ? short(rangeStart) : `${short(rangeStart)}–${short(previous)}`);
  }

  return ranges.join(', ');
}

export function labelize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Splits plain-text content into paragraphs on blank lines. */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
