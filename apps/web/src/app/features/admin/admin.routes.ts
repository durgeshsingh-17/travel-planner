import { Routes } from '@angular/router';

import { adminGuard } from '../../core/guards/role.guard';
import { unsavedChangesGuard } from './shared/unsaved-changes.guard';

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      { path: '', loadComponent: () => import('./admin-dashboard.component').then((m) => m.AdminDashboardComponent) },
      {
        path: 'destinations',
        data: { entity: 'destinations' },
        loadComponent: () => import('./admin-content-list.component').then((m) => m.AdminContentListComponent)
      },
      {
        path: 'destinations/:id',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./admin-destination-editor.component').then((m) => m.AdminDestinationEditorComponent)
      },
      {
        path: 'places',
        data: { entity: 'places' },
        loadComponent: () => import('./admin-content-list.component').then((m) => m.AdminContentListComponent)
      },
      {
        path: 'places/:id',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./admin-place-editor.component').then((m) => m.AdminPlaceEditorComponent)
      },
      {
        path: 'collections',
        data: { entity: 'collections' },
        loadComponent: () => import('./admin-content-list.component').then((m) => m.AdminContentListComponent)
      },
      {
        path: 'collections/:id',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./admin-collection-editor.component').then((m) => m.AdminCollectionEditorComponent)
      },
      {
        path: 'packages',
        data: { entity: 'packages' },
        loadComponent: () => import('./admin-content-list.component').then((m) => m.AdminContentListComponent)
      },
      {
        path: 'packages/:id',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./admin-package-editor.component').then((m) => m.AdminPackageEditorComponent)
      },
      { path: 'reviews', loadComponent: () => import('./admin-reviews.component').then((m) => m.AdminReviewsComponent) },
      {
        path: 'agents',
        canActivate: [adminGuard],
        loadComponent: () => import('./admin-agents.component').then((m) => m.AdminAgentsComponent)
      },
      {
        path: 'quotes',
        canActivate: [adminGuard],
        loadComponent: () => import('./admin-quote-requests.component').then((m) => m.AdminQuoteRequestsComponent)
      },
      {
        path: 'quotes/:id',
        canActivate: [adminGuard],
        loadComponent: () => import('./admin-quote-requests.component').then((m) => m.AdminQuoteRequestsComponent)
      },
      { path: 'tags', loadComponent: () => import('./admin-tags.component').then((m) => m.AdminTagsComponent) },
      { path: 'media', loadComponent: () => import('./admin-media.component').then((m) => m.AdminMediaComponent) },
      { path: 'import', loadComponent: () => import('./admin-import.component').then((m) => m.AdminImportComponent) },
      { path: 'audit', loadComponent: () => import('./admin-audit.component').then((m) => m.AdminAuditComponent) },
      { path: 'users', loadComponent: () => import('./admin-users.component').then((m) => m.AdminUsersComponent) }
    ]
  }
];
