import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-route-map',
  standalone: true,
  template: `
    <section class="route-map">
      <iframe [src]="safeUrl" title="Route map preview" loading="lazy"></iframe>
      <a class="map-action" [href]="mapUrl" target="_blank" rel="noopener noreferrer">
        Open interactive map
      </a>
    </section>
  `,
  styles: [
    `
      .route-map {
        position: relative;
        overflow: hidden;
        min-height: 320px;
        border: 1px solid rgba(23, 33, 27, 0.1);
        border-radius: 8px;
        background: var(--surface);
      }

      iframe {
        display: block;
        width: 100%;
        height: 360px;
        border: 0;
        pointer-events: none;
      }

      .map-action {
        position: absolute;
        right: 14px;
        bottom: 14px;
        z-index: 2;
        display: inline-flex;
        align-items: center;
        min-height: 40px;
        padding: 0 14px;
        color: #ffffff;
        background: #0b625d;
        border-radius: 8px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
        font-weight: 900;
        text-decoration: none;
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
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.embedUrl);
  }

  get mapUrl(): string {
    return `https://www.openstreetmap.org/?mlat=${this.destinationLatitude()}&mlon=${this.destinationLongitude()}#map=9/${this.destinationLatitude()}/${this.destinationLongitude()}`;
  }

  private get embedUrl(): string {
    const minLatitude =
      Math.min(this.sourceLatitude(), this.destinationLatitude()) - 0.6;
    const maxLatitude =
      Math.max(this.sourceLatitude(), this.destinationLatitude()) + 0.6;
    const minLongitude =
      Math.min(this.sourceLongitude(), this.destinationLongitude()) - 0.6;
    const maxLongitude =
      Math.max(this.sourceLongitude(), this.destinationLongitude()) + 0.6;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${minLongitude},${minLatitude},${maxLongitude},${maxLatitude}&layer=mapnik&marker=${this.destinationLatitude()},${this.destinationLongitude()}`;
  }
}
