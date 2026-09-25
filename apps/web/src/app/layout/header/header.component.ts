import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';

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

  protected readonly isDarkMode = signal(false);

  constructor() {
    const storedTheme = this.document.defaultView?.localStorage.getItem('theme');
    const prefersDark = this.document.defaultView?.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches;
    this.setTheme(storedTheme === 'dark' || (!storedTheme && !!prefersDark));
  }

  protected toggleTheme(isDark: boolean): void {
    this.setTheme(isDark);
    this.document.defaultView?.localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }

  private setTheme(isDark: boolean): void {
    this.isDarkMode.set(isDark);
    this.document.body.classList.toggle('dark-theme', isDark);
  }
}
