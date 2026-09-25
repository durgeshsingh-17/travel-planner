import { Decimal } from '@prisma/client/runtime/library';

export function decimalToNumber(value: Decimal | number | null): number | null {
  if (value === null) {
    return null;
  }

  return typeof value === 'number' ? value : value.toNumber();
}
