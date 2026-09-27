export interface SelectOption {
  label: string;
  value: string;
}

export const travelModes: SelectOption[] = [
  { label: 'Car', value: 'CAR' },
  { label: 'Bike', value: 'BIKE' },
  { label: 'Bus', value: 'BUS' },
  { label: 'Flight', value: 'FLIGHT' }
];

export const paceOptions: SelectOption[] = [
  { label: 'Relaxed', value: 'RELAXED' },
  { label: 'Balanced', value: 'BALANCED' },
  { label: 'Packed', value: 'PACKED' }
];

export const driveLimitOptions = [
  { label: 'Usual for this mode', value: 0 },
  { label: '4 hours', value: 4 },
  { label: '6 hours', value: 6 },
  { label: '8 hours', value: 8 },
  { label: '10 hours', value: 10 }
];

export const interestOptions: SelectOption[] = [
  { label: 'Mountains', value: 'mountains' },
  { label: 'Photography', value: 'photography' },
  { label: 'Food', value: 'food' },
  { label: 'Peaceful', value: 'peaceful' },
  { label: 'Culture', value: 'culture' },
  { label: 'Nature', value: 'nature' },
  { label: 'Adventure', value: 'adventure' },
  { label: 'Cafes', value: 'cafes' }
];

export const preferenceOptions: SelectOption[] = [
  { label: 'Avoid night driving', value: 'avoid-night-driving' },
  { label: 'Scenic route', value: 'scenic-route' },
  { label: 'Budget friendly', value: 'budget-friendly' },
  { label: 'Less crowded', value: 'less-crowded' },
  { label: 'Food lover', value: 'food-lover' },
  { label: 'Adventure', value: 'adventure' },
  { label: 'Family friendly', value: 'family-friendly' }
];
