import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SessionService } from '../../core/auth/session.service';
import { SeoService } from '../../core/seo/seo.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="admin-shell">
      <nav aria-label="Admin">
        <p class="eyebrow">Admin</p>
        @for (link of links(); track link.path) {
          <a [routerLink]="link.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: link.exact }">
            {{ link.label }}
          </a>
        }
      </nav>
      <div class="admin-main"><router-outlet /></div>
    </div>
  `,
  styles: `
    .admin-shell { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 24px; max-width: 1320px; margin: 0 auto; padding: 24px 20px 64px; }
    nav { position: sticky; top: 84px; align-self: start; display: grid; gap: 2px; }
    nav a { padding: 8px 10px; border-radius: 8px; color: var(--text); text-decoration: none; font-weight: 600; }
    nav a:hover { background: var(--surface); }
    nav a.active { background: var(--primary); color: #fff; }
    .eyebrow { margin: 0 0 8px; }
    @media (max-width: 800px) {
      .admin-shell { grid-template-columns: 1fr; }
      nav { position: static; display: flex; flex-wrap: wrap; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminShellComponent {
  private readonly session = inject(SessionService);

  protected readonly links = computed(() => {
    const isAdmin = this.session.session().user?.role === 'ADMIN';
    return [
      { path: '/admin', label: 'Dashboard', exact: true },
      { path: '/admin/destinations', label: 'Destinations', exact: false },
      { path: '/admin/places', label: 'Places', exact: false },
      { path: '/admin/collections', label: 'Collections', exact: false },
      { path: '/admin/tags', label: 'Tags', exact: false },
      { path: '/admin/media', label: 'Media', exact: false },
      { path: '/admin/audit', label: 'Audit log', exact: false },
      ...(isAdmin
        ? [
            { path: '/admin/import', label: 'Import', exact: false },
            { path: '/admin/users', label: 'Users', exact: false }
          ]
        : [])
    ];
  });

  constructor() {
    inject(SeoService).setPage({ title: 'Admin', description: 'Content administration', path: '/admin', noindex: true });
  }
}
