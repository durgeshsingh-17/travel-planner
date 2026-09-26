import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { AuthGuard } from '../auth/auth.guard';
import { SavedTripsController } from '../saved-trips/saved-trips.controller';
import { VehiclesController } from '../vehicles/vehicles.controller';
import { TripsController } from './trips.controller';

function guardsFor(controller: new (...args: never[]) => unknown, method: string) {
  const handler = (controller.prototype as Record<string, unknown>)[method] as object;
  return [
    ...((Reflect.getMetadata(GUARDS_METADATA, controller) as unknown[]) ?? []),
    ...((Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[]) ?? [])
  ];
}

function routeMethods(controller: new (...args: never[]) => unknown): string[] {
  return Object.getOwnPropertyNames(controller.prototype).filter(
    (name) => name !== 'constructor'
  );
}

describe('route authorization', () => {
  const publicRoutes: Record<string, string[]> = {
    TripsController: ['preview'],
    VehiclesController: ['findAll'],
    SavedTripsController: []
  };

  for (const controller of [TripsController, VehiclesController, SavedTripsController]) {
    for (const method of routeMethods(controller)) {
      const isPublic = publicRoutes[controller.name].includes(method);

      it(`${controller.name}.${method} is ${isPublic ? 'public' : 'guarded'}`, () => {
        const guards = guardsFor(controller, method);
        expect(guards.includes(AuthGuard)).toBe(!isPublic);
      });
    }
  }
});
