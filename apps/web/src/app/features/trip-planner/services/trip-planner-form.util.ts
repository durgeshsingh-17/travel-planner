export interface TravellerDraft {
  fullName: string;
  age: number | null;
  gender: string;
}

export function normalizePassengerCount(count: number): number {
  return Math.max(count, 1);
}

export function isTravellerDraftValid(traveller: TravellerDraft): boolean {
  return (
    traveller.fullName.trim().length >= 2 &&
    traveller.age !== null &&
    traveller.age >= 0 &&
    traveller.age <= 120 &&
    traveller.gender.trim().length > 0
  );
}
