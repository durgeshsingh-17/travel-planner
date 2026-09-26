import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';

import { SessionService } from '../../core/auth/session.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [MatButtonModule, MatSlideToggleModule, MatToolbarModule, RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  private readonly document = inject(DOCUMENT);
  protected readonly session = inject(SessionService);

  protected readonly isDarkMode = signal(false);

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    if (!this.isBrowser) {
      // The inline script in index.html applies the saved theme before first paint.
      return;
    }

    this.setTheme(this.document.body.classList.contains('dark-theme'));
  }

  protected toggleTheme(isDark: boolean): void {
    this.setTheme(isDark);

    try {
      this.document.defaultView?.localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch {
      // Storage unavailable: the choice lasts for this page view only.
    }
  }

  private setTheme(isDark: boolean): void {
    this.isDarkMode.set(isDark);
    this.document.body.classList.toggle('dark-theme', isDark);
  }
}
