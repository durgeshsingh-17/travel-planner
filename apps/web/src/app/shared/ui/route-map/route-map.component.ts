import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-route-map',
  standalone: true,
  template: `
    <section class="route-map">
      <iframe [src]="safeUrl" title="Route map" loading="lazy"></iframe>
    </section>
  `,
  styles: [
    `
      .route-map {
        overflow: hidden;
        min-height: 320px;
        border: 1px solid rgba(23, 33, 27, 0.1);
        border-radius: 8px;
      }

      iframe {
        display: block;
        width: 100%;
        height: 360px;
        border: 0;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RouteMapComponent {
  readonly sourceLatitude = input.required<number>();
  readonly sourceLongitude = input.required<number>();
  readonly destinationLatitude = input.required<number>();
  readonly destinationLongitude = input.required<number>();

  constructor(private readonly sanitizer: DomSanitizer) {}

  get safeUrl(): SafeResourceUrl {
    const minLatitude =
      Math.min(this.sourceLatitude(), this.destinationLatitude()) - 0.6;
    const maxLatitude =
      Math.max(this.sourceLatitude(), this.destinationLatitude()) + 0.6;
    const minLongitude =
      Math.min(this.sourceLongitude(), this.destinationLongitude()) - 0.6;
    const maxLongitude =
      Math.max(this.sourceLongitude(), this.destinationLongitude()) + 0.6;
    const url = `https://www.openstreetmap.org/export/embed.html?bbox=${minLongitude},${minLatitude},${maxLongitude},${maxLatitude}&layer=mapnik&marker=${this.destinationLatitude()},${this.destinationLongitude()}`;

    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
