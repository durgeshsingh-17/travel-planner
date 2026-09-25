import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import {
  budgetTrips,
  moodCards,
  popularDestinations,
  trendingRoadTrips
} from './data/home-travel.data';
import { SectionCarouselComponent } from '../../shared/ui/section-carousel/section-carousel.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    RouterLink,
    SectionCarouselComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent {
  protected readonly trendingRoadTrips = trendingRoadTrips;
  protected readonly popularDestinations = popularDestinations;
  protected readonly budgetTrips = budgetTrips;
  protected readonly moodCards = moodCards;
}
