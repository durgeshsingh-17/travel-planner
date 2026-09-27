import { Routes } from '@angular/router';

import { ShellComponent } from './layout/shell/shell.component';
import { authGuard } from './core/guards/auth.guard';
import { agentGuard, editorGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/home/home.component').then(
            (component) => component.HomeComponent
          )
      },
      {
        path: 'plan',
        loadComponent: () =>
          import('./features/trip-planner/trip-planner.component').then(
            (component) => component.TripPlannerComponent
          )
      },
      {
        path: 'trip/:id',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/trip-result/trip-result.component').then(
            (component) => component.TripResultComponent
          )
      },
      {
        path: 't/:shareSlug',
        loadComponent: () =>
          import('./features/trip-result/trip-result.component').then(
            (component) => component.TripResultComponent
          )
      },
      {
        path: 'explore',
        redirectTo: 'destinations'
      },
      {
        path: 'destinations',
        loadComponent: () =>
          import('./features/explore/explore.component').then(
            (component) => component.ExploreComponent
          )
      },
      {
        path: 'destinations/:slug',
        loadComponent: () =>
          import('./features/destinations/destination-detail.component').then(
            (component) => component.DestinationDetailComponent
          )
      },
      {
        path: 'destinations/:slug/places',
        loadComponent: () =>
          import('./features/destinations/destination-places.component').then(
            (component) => component.DestinationPlacesComponent
          )
      },
      {
        path: 'destinations/:slug/places/:placeSlug',
        loadComponent: () =>
          import('./features/places/place-detail.component').then(
            (component) => component.PlaceDetailComponent
          )
      },
      {
        path: 'packages',
        loadComponent: () =>
          import('./features/packages/packages-list.component').then((component) => component.PackagesListComponent)
      },
      {
        path: 'packages/:slug',
        loadComponent: () =>
          import('./features/packages/package-detail.component').then((component) => component.PackageDetailComponent)
      },
      {
        path: 'quote',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/quotes/quote-request.component').then((component) => component.QuoteRequestComponent)
      },
      {
        path: 'quotes',
        canActivate: [authGuard],
        loadComponent: () => import('./features/quotes/my-quotes.component').then((component) => component.MyQuotesComponent)
      },
      {
        path: 'quotes/:id',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/quotes/quote-request-detail.component').then((component) => component.QuoteRequestDetailComponent)
      },
      {
        path: 'agent',
        canActivate: [agentGuard],
        loadComponent: () => import('./features/agent/agent-inbox.component').then((component) => component.AgentInboxComponent)
      },
      {
        path: 'agent/requests/:id',
        canActivate: [agentGuard],
        loadComponent: () => import('./features/agent/agent-request.component').then((component) => component.AgentRequestComponent)
      },
      {
        path: 'collections/:slug',
        loadComponent: () =>
          import('./features/collections/collection-page.component').then(
            (component) => component.CollectionPageComponent
          )
      },
      {
        path: 'itinerary',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/itinerary/itinerary.component').then(
            (component) => component.ItineraryComponent
          )
      },
      {
        path: 'profile',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/profile/profile.component').then(
            (component) => component.ProfileComponent
          )
      },
      {
        path: 'saved-trips',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/saved-trips/saved-trips.component').then(
            (component) => component.SavedTripsComponent
          )
      },
      {
        path: 'trip-details',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/trip-details/trip-details.component').then(
            (component) => component.TripDetailsComponent
          )
      },
      {
        path: 'trip-details/:id',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/trip-details/trip-details.component').then(
            (component) => component.TripDetailsComponent
          )
      },
      {
        path: 'vehicles',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/vehicles/vehicles.component').then(
            (component) => component.VehiclesComponent
          )
      },
      {
        path: 'admin',
        canActivate: [editorGuard],
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.adminRoutes)
      },
      {
        path: 'sign-in',
        loadComponent: () =>
          import('./features/auth/auth-page.component').then(
            (component) => component.AuthPageComponent
          )
      },
      {
        path: 'sign-up',
        loadComponent: () =>
          import('./features/auth/auth-page.component').then(
            (component) => component.AuthPageComponent
          )
      },
      {
        path: '**',
        loadComponent: () =>
          import('./features/not-found/not-found.component').then((component) => component.NotFoundComponent)
      }
    ]
  }
];
