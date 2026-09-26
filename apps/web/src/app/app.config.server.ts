import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';

import { API_BASE_URL, SITE_URL } from './core/config/api.config';
import { appConfig } from './app.config';
import { environment } from '../environments/environment';
import { serverRoutes } from './app.routes.server';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // Lets the server reach the API over an internal address in production.
    { provide: API_BASE_URL, useValue: env['SSR_API_BASE_URL'] ?? environment.apiBaseUrl },
    { provide: SITE_URL, useValue: env['SITE_URL'] ?? environment.siteUrl }
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
