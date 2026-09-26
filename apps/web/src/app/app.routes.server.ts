import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Public, indexable pages render on the server so search engines and link
 * previews get full HTML. Everything personal (trips, profile, admin, the
 * planner's saved drafts) renders in the browser only.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
  { path: 'destinations', renderMode: RenderMode.Server },
  { path: 'destinations/:slug', renderMode: RenderMode.Server },
  { path: 'destinations/:slug/places', renderMode: RenderMode.Server },
  { path: 'destinations/:slug/places/:placeSlug', renderMode: RenderMode.Server },
  { path: 'collections/:slug', renderMode: RenderMode.Server },
  { path: 't/:shareSlug', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Client }
];
