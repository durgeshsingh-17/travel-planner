import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

import { SeoService } from '../../core/seo/seo.service';

/** Unknown URLs: a helpful page with a real 404 status (not a soft redirect to home). */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [MatButtonModule, RouterLink],
  template: `
    <main class="not-found app-page">
      <p class="page-kicker">404</p>
      <h1 class="page-title">We couldn't find that page</h1>
      <p class="page-copy">The link may be old, or the page may have moved. Try one of these instead.</p>
      <nav aria-label="Suggestions">
        <a mat-flat-button color="primary" routerLink="/destinations">Browse destinations</a>
        <a mat-stroked-button routerLink="/packages">See packages</a>
        <a mat-button routerLink="/plan">Plan a road trip</a>
      </nav>
    </main>
  `,
  styles: [
    `
      .not-found {
        display: grid;
        gap: 14px;
        max-width: 720px;
        margin: 0 auto;
        padding: 72px 16px;
      }

      nav {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 10px;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotFoundComponent {
  constructor() {
    inject(SeoService).notFound('Page');
  }
}
