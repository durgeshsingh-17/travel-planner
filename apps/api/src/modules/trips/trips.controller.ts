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
  create(@Body() dto: CreateTripDto) {
    return this.tripsService.create(dto);
  }

  @Get()
  findAll() {
    return this.tripsService.findAll();
  }

  @Get(':id')
  findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tripsService.findById(id);
  }

  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateTripDto) {
    return this.tripsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tripsService.delete(id);
  }

  @Post(':id/generate-itinerary')
  generateItinerary(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tripsService.generateItinerary(id);
  }
}
