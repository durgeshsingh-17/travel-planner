export function normalizeIndianRegistration(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidIndianRegistration(value: string): boolean {
  const normalized = normalizeIndianRegistration(value);
  return (
    /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/.test(normalized) ||
    /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(normalized)
  );
}

export function formatIndianRegistration(value: string): string {
  const normalized = normalizeIndianRegistration(value);
  const stateMatch = normalized.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{4})$/);
  const bharatMatch = normalized.match(/^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/);

  if (stateMatch) {
    return `${stateMatch[1]} ${stateMatch[2]} ${stateMatch[3]} ${stateMatch[4]}`;
  }

  if (bharatMatch) {
    return `${bharatMatch[1]} ${bharatMatch[2]} ${bharatMatch[3]} ${bharatMatch[4]}`;
  }

  return value.toUpperCase();
}
