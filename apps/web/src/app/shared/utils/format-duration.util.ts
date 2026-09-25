export function formatDuration(minutes?: number | null): string {
  if (!minutes) {
    return 'Pending';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
