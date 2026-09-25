import { Routes } from '@angular/router';

import { ShellComponent } from './layout/shell/shell.component';

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
        loadComponent: () =>
          import('./features/trip-result/trip-result.component').then(
            (component) => component.TripResultComponent
          )
      },
      {
        path: 'explore',
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
        path: 'itinerary',
        loadComponent: () =>
          import('./features/itinerary/itinerary.component').then(
            (component) => component.ItineraryComponent
          )
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then(
            (component) => component.ProfileComponent
          )
      },
      {
        path: 'saved-trips',
        loadComponent: () =>
          import('./features/saved-trips/saved-trips.component').then(
            (component) => component.SavedTripsComponent
          )
      },
      {
        path: 'trip-details',
        loadComponent: () =>
          import('./features/trip-details/trip-details.component').then(
            (component) => component.TripDetailsComponent
          )
      },
      {
        path: 'trip-details/:id',
        loadComponent: () =>
          import('./features/trip-details/trip-details.component').then(
            (component) => component.TripDetailsComponent
          )
      },
      {
        path: 'vehicles',
        loadComponent: () =>
          import('./features/vehicles/vehicles.component').then(
            (component) => component.VehiclesComponent
          )
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
        redirectTo: ''
      }
    ]
  }
];
