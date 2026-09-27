import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReviewStatus } from '@prisma/client';

import { CreateReviewDto, ListReviewsQueryDto, ModerateReviewDto, UpdateReviewDto } from './dto/review.dto';
import { CurrentUserId } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { ReviewsService } from './reviews.service';
import { Roles } from '../auth/roles.decorator';

const uuid = new ParseUUIDPipe();

@ApiTags('reviews')
@Controller({ version: '1' })
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('reviews')
  list(@Query() query: ListReviewsQueryDto) {
    return this.reviews.listPublic(query);
  }

  @Post('reviews')
  create(@CurrentUserId() userId: string, @Body() dto: CreateReviewDto) {
    return this.reviews.create(userId, dto);
  }

  @Get('me/reviews')
  mine(@CurrentUserId() userId: string) {
    return this.reviews.mine(userId);
  }

  @Put('me/reviews/:id')
  update(@CurrentUserId() userId: string, @Param('id', uuid) id: string, @Body() dto: UpdateReviewDto) {
    return this.reviews.update(userId, id, dto);
  }

  @Delete('me/reviews/:id')
  remove(@CurrentUserId() userId: string, @Param('id', uuid) id: string) {
    return this.reviews.remove(userId, id);
  }
}

@ApiTags('admin')
@Roles('EDITOR', 'ADMIN')
@Controller({ path: 'admin/reviews', version: '1' })
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  queue(@Query('status', new ParseEnumPipe(ReviewStatus, { optional: true })) status?: ReviewStatus) {
    return this.reviews.moderationQueue(status);
  }

  @HttpCode(200)
  @Post(':id/moderate')
  moderate(@Param('id', uuid) id: string, @Body() dto: ModerateReviewDto, @CurrentUserId() actorId: string) {
    return this.reviews.moderate(id, dto.decision, dto.note, actorId);
  }
}
