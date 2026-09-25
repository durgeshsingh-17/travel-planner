export function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function assertDateRange(startDate: string, endDate: string): boolean {
  return toDateOnly(endDate).getTime() >= toDateOnly(startDate).getTime();
}
