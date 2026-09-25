export function normalizeIndianRegistration(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidIndianRegistration(value: string): boolean {
  const normalized = normalizeIndianRegistration(value);
  const stateRegistration = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/.test(normalized);
  const bharatRegistration = /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(normalized);

  return stateRegistration || bharatRegistration;
}
