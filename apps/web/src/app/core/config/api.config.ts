import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';

/**
 * Base URL of the REST API. The browser uses the public URL from the
 * environment; the SSR server can override it (SSR_API_BASE_URL) to call the
 * API over an internal address.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl
});

/**
 * Public origin of the site, used for canonical URLs and structured data.
 * The browser knows its own origin; the SSR server is told via SITE_URL.
 */
export const SITE_URL = new InjectionToken<string>('SITE_URL', {
  providedIn: 'root',
  factory: () => (typeof window !== 'undefined' && window.location?.origin) || environment.siteUrl
});
