import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { CreateTripDto } from './dto/create-trip.dto';
import { PreviewTripDto } from './dto/preview-trip.dto';
import { TripsService } from './trips.service';
import { UpdateTripDto } from './dto/update-trip.dto';

@ApiTags('trips')
@Controller({
  path: 'trips',
  version: '1'
})
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post('preview')
  preview(@Body() dto: PreviewTripDto) {
    return this.tripsService.preview(dto);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(@Body() dto: CreateTripDto, @CurrentUserId() userId: string) {
    return this.tripsService.create(dto, userId);
  }

  @Get()
  @UseGuards(AuthGuard)
  findAll(@CurrentUserId() userId: string) {
    return this.tripsService.findAll(userId);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  findById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUserId() userId: string
  ) {
    return this.tripsService.findById(id, userId);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTripDto,
    @CurrentUserId() userId: string
  ) {
    return this.tripsService.update(id, dto, userId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  delete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUserId() userId: string
  ) {
    return this.tripsService.delete(id, userId);
  }

  @Post(':id/generate-itinerary')
  @UseGuards(AuthGuard)
  generateItinerary(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUserId() userId: string
  ) {
    return this.tripsService.generateItinerary(id, userId);
  }

  @Post(':id/share')
  @UseGuards(AuthGuard)
  enableSharing(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUserId() userId: string
  ) {
    return this.tripsService.enableSharing(id, userId);
  }

  @Delete(':id/share')
  @UseGuards(AuthGuard)
  disableSharing(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUserId() userId: string
  ) {
    return this.tripsService.disableSharing(id, userId);
  }
}
