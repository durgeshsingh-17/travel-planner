import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';

import { TravelCard } from '../../../features/home/models/travel-card.model';
import { TripCardComponent } from '../trip-card/trip-card.component';

@Component({
  selector: 'app-section-carousel',
  standalone: true,
  imports: [MatDividerModule, TripCardComponent],
  templateUrl: './section-carousel.component.html',
  styleUrl: './section-carousel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SectionCarouselComponent {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly cards = input.required<TravelCard[]>();
}
