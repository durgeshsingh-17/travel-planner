import 'reflect-metadata';
import { RequestMethod, Type } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';

import { AppModule } from './app.module';
import { AuthGuard } from './modules/auth/auth.guard';
import { IS_PUBLIC_KEY } from './modules/auth/public.decorator';
import { ROLES_KEY } from './modules/auth/roles.decorator';
import { RolesGuard } from './modules/auth/roles.guard';

/**
 * Every route in the app requires sign-in unless it is listed here. Adding a
 * public route means adding it to this list on purpose, in review.
 */
const PUBLIC_ROUTES = [
  'GET /auth/status',
  'POST /auth/register',
  'POST /auth/login',
  'POST /auth/refresh',
  'POST /auth/logout',
  'GET /health',
  'GET /locations',
  'GET /destinations',
  'GET /destinations/facets',
  'GET /destinations/:slug',
  'GET /destinations/:slug/places',
  'GET /destinations/:slug/places/:placeSlug',
  'GET /collections',
  'GET /collections/:slug',
  'GET /tags',
  'GET /search/suggest',
  'GET /home',
  'GET /seo/sitemap-entries',
  'GET /places',
  'GET /vehicles',
  'GET /maps/status',
  'GET /maps/route',
  'GET /weather/status',
  'GET /weather/forecast',
  'POST /trips/preview',
  'GET /shared-trips/:shareSlug'
].sort();

interface RouteInfo {
  key: string;
  isPublic: boolean;
  roles: string[];
}

function modulesOf(module: Type<unknown>): Type<unknown>[] {
  const imports = (Reflect.getMetadata('imports', module) as unknown[] | undefined) ?? [];
  return imports.filter((entry): entry is Type<unknown> => typeof entry === 'function');
}

function controllersOf(module: Type<unknown>): Type<unknown>[] {
  return (Reflect.getMetadata('controllers', module) as Type<unknown>[] | undefined) ?? [];
}

function joinPath(...parts: string[]): string {
  const path = parts
    .flatMap((part) => part.split('/'))
    .filter(Boolean)
    .join('/');
  return `/${path}`;
}

function collectRoutes(): RouteInfo[] {
  const controllers = new Set(modulesOf(AppModule).flatMap(controllersOf));
  const routes: RouteInfo[] = [];

  for (const controller of controllers) {
    const controllerPath = (Reflect.getMetadata(PATH_METADATA, controller) as string) ?? '';
    const classPublic = Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true;
    const classRoles = (Reflect.getMetadata(ROLES_KEY, controller) as string[]) ?? [];

    for (const name of Object.getOwnPropertyNames(controller.prototype)) {
      const handler = (controller.prototype as Record<string, unknown>)[name];

      if (typeof handler !== 'function' || !Reflect.hasMetadata(METHOD_METADATA, handler)) {
        continue;
      }

      const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number];
      const handlerPath = (Reflect.getMetadata(PATH_METADATA, handler) as string) ?? '';
      routes.push({
        key: `${method} ${joinPath(controllerPath, handlerPath)}`,
        isPublic: classPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true,
        roles: (Reflect.getMetadata(ROLES_KEY, handler) as string[]) ?? classRoles
      });
    }
  }

  return routes;
}

describe('route access rules', () => {
  const routes = collectRoutes();

  it('discovers the application routes', () => {
    expect(routes.length).toBeGreaterThan(30);
    expect(new Set(routes.map((route) => route.key)).size).toBe(routes.length);
  });

  it('registers throttling, authentication and role checks as global guards in that order', () => {
    const providers = (Reflect.getMetadata('providers', AppModule) as Array<{
      provide?: unknown;
      useClass?: unknown;
      useExisting?: unknown;
    }>).filter((provider) => provider.provide === APP_GUARD);

    expect(providers.map((provider) => provider.useClass ?? provider.useExisting)).toEqual([
      ThrottlerGuard,
      AuthGuard,
      RolesGuard
    ]);
  });

  it('only exposes the routes on the public allow-list', () => {
    const publicRoutes = routes.filter((route) => route.isPublic).map((route) => route.key);
    expect(publicRoutes.sort()).toEqual(PUBLIC_ROUTES);
  });

  it('requires a role on every admin route', () => {
    const adminRoutes = routes.filter((route) => route.key.split(' ')[1].startsWith('/admin'));

    for (const route of adminRoutes) {
      expect(route.isPublic, `${route.key} must not be public`).toBe(false);
      expect(route.roles.length, `${route.key} must declare @Roles`).toBeGreaterThan(0);
    }
  });
});
