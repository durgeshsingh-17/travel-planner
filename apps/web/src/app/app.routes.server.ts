import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Public, indexable pages render on the server so search engines and link
 * previews get full HTML. Everything personal (trips, profile, admin, the
 * planner's saved drafts) renders in the browser only. Keep this list in
 * step with app.routes.ts.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
  { path: 'destinations', renderMode: RenderMode.Server },
  { path: 'destinations/:slug', renderMode: RenderMode.Server },
  { path: 'destinations/:slug/places', renderMode: RenderMode.Server },
  { path: 'destinations/:slug/places/:placeSlug', renderMode: RenderMode.Server },
  { path: 'collections/:slug', renderMode: RenderMode.Server },
  { path: 'packages', renderMode: RenderMode.Server },
  { path: 'packages/:slug', renderMode: RenderMode.Server },
  { path: 't/:shareSlug', renderMode: RenderMode.Server },
  // Personal and signed-in pages: browser only (no user data in server HTML).
  ...[
    'plan',
    'trip/:id',
    'quote',
    'quotes',
    'quotes/:id',
    'agent',
    'agent/requests/:id',
    'itinerary',
    'profile',
    'saved-trips',
    'trip-details',
    'trip-details/:id',
    'vehicles',
    'admin',
    'admin/**',
    'sign-in',
    'sign-up'
  ].map((path): ServerRoute => ({ path, renderMode: RenderMode.Client })),
  // Anything else is unknown: render the not-found page on the server so it answers 404.
  { path: '**', renderMode: RenderMode.Server }
];
