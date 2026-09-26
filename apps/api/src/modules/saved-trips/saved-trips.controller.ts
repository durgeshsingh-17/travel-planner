import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CurrentUserId } from '../auth/current-user.decorator';
import { ImportSavedTripsDto } from './dto/import-saved-trips.dto';
import { SavedTripsService } from './saved-trips.service';

@ApiTags('saved-trips')
@Controller({
  path: 'me/saved-trips',
  version: '1'
})
export class SavedTripsController {
  constructor(private readonly savedTripsService: SavedTripsService) {}

  @Get()
  findAll(@CurrentUserId() userId: string) {
    return this.savedTripsService.findAll(userId);
  }

  @Put(':tripId')
  save(
    @CurrentUserId() userId: string,
    @Param('tripId', new ParseUUIDPipe()) tripId: string
  ) {
    return this.savedTripsService.save(userId, tripId);
  }

  @Delete(':tripId')
  remove(
    @CurrentUserId() userId: string,
    @Param('tripId', new ParseUUIDPipe()) tripId: string
  ) {
    return this.savedTripsService.remove(userId, tripId);
  }

  /** One-time migration of trip ids that older app versions kept in localStorage. */
  @Post('import')
  import(@CurrentUserId() userId: string, @Body() dto: ImportSavedTripsDto) {
    return this.savedTripsService.import(userId, dto.tripIds);
  }
}
