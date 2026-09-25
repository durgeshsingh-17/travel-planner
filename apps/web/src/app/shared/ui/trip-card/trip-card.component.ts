import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'app-trip-card',
  standalone: true,
  imports: [MatCardModule, MatChipsModule],
  templateUrl: './trip-card.component.html',
  styleUrl: './trip-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripCardComponent {
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly imageUrl = input.required<string>();
  readonly meta = input.required<string>();
  readonly tag = input.required<string>();
}
