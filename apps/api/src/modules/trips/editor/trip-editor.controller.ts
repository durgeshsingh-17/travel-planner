import { Body, Controller, Delete, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AddActivityDto, ReorderDayDto, UpdateActivityDto } from '../dto/itinerary-edit.dto';
import { CurrentUserId } from '../../auth/current-user.decorator';
import { TripEditorService } from './trip-editor.service';
import { WRITE_THROTTLE } from '../../../common/throttle/write.throttle';

/** Itinerary edits; every route is owner-only through the trip lookup. */
@ApiTags('trips')
@Controller({
  path: 'trips/:id',
  version: '1'
})
export class TripEditorController {
  constructor(private readonly editor: TripEditorService) {}

  @Put('days/:dayNumber/order')
  reorder(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('dayNumber', ParseIntPipe) dayNumber: number,
    @Body() dto: ReorderDayDto,
    @CurrentUserId() userId: string
  ) {
    return this.editor.reorderDay(id, dayNumber, dto.activityIds, userId);
  }

  @Post('days/:dayNumber/activities')
  add(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('dayNumber', ParseIntPipe) dayNumber: number,
    @Body() dto: AddActivityDto,
    @CurrentUserId() userId: string
  ) {
    return this.editor.addActivity(id, dayNumber, dto, userId);
  }

  // Re-planning calls the road router; keep it modest.
  @Throttle(WRITE_THROTTLE)
  @Post('days/:dayNumber/regenerate')
  regenerate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('dayNumber', ParseIntPipe) dayNumber: number,
    @CurrentUserId() userId: string
  ) {
    return this.editor.regenerateDay(id, dayNumber, userId);
  }

  @Patch('activities/:activityId')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('activityId', new ParseUUIDPipe()) activityId: string,
    @Body() dto: UpdateActivityDto,
    @CurrentUserId() userId: string
  ) {
    return this.editor.updateActivity(id, activityId, dto, userId);
  }

  @Delete('activities/:activityId')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('activityId', new ParseUUIDPipe()) activityId: string,
    @CurrentUserId() userId: string
  ) {
    return this.editor.removeActivity(id, activityId, userId);
  }
}
