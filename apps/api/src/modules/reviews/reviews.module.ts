import { Module } from '@nestjs/common';

import { AdminReviewsController, ReviewsController } from './reviews.controller';
import { ContentModule } from '../content/content.module';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [ContentModule],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService]
})
export class ReviewsModule {}
