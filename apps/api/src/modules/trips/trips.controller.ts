import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CurrentUserId } from '../auth/current-user.decorator';
import { CreateTripDto } from './dto/create-trip.dto';
import { PreviewTripDto } from './dto/preview-trip.dto';
import { TripsService } from './trips.service';
import { UpdateTripDto } from './dto/update-trip.dto';
import { Public } from '../auth/public.decorator';

@ApiTags('trips')
@Controller({
  path: 'trips',
  version: '1'
})
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Public()
  @Post('preview')
  preview(@Body() dto: PreviewTripDto) {
    return this.tripsService.preview(dto);
  }

  @Post()
  create(@Body() dto: CreateTripDto, @CurrentUserId() userId: string) {
    return this.tripsService.create(dto, userId);
  }

  @Get()
  findAll(@CurrentUserId() userId: string) {
    return this.tripsService.findAll(userId);
  }

  @Get(':id')
  findById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUserId() userId: string
  ) {
    return this.tripsService.findById(id, userId);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTripDto,
    @CurrentUserId() userId: string
  ) {
    return this.tripsService.update(id, dto, userId);
  }

  @Delete(':id')
  delete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUserId() userId: string
  ) {
    return this.tripsService.delete(id, userId);
  }

  @Post(':id/generate-itinerary')
  generateItinerary(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUserId() userId: string
  ) {
    return this.tripsService.generateItinerary(id, userId);
  }

  @Post(':id/share')
  enableSharing(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUserId() userId: string
  ) {
    return this.tripsService.enableSharing(id, userId);
  }

  @Delete(':id/share')
  disableSharing(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUserId() userId: string
  ) {
    return this.tripsService.disableSharing(id, userId);
  }
}
