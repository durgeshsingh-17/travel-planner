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
