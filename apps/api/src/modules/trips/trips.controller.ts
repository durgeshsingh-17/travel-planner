import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreateTripDto } from './dto/create-trip.dto';
import { PreviewTripDto } from './dto/preview-trip.dto';
import { TripsService } from './trips.service';
import { UpdateTripDto } from './dto/update-trip.dto';
import { AuthService } from '../auth/auth.service';

@ApiTags('trips')
@Controller({
  path: 'trips',
  version: '1'
})
export class TripsController {
  constructor(
    private readonly authService: AuthService,
    private readonly tripsService: TripsService
  ) {}

  @Post('preview')
  preview(@Body() dto: PreviewTripDto) {
    return this.tripsService.preview(dto);
  }

  @Post()
  create(@Body() dto: CreateTripDto, @Headers('authorization') authorization?: string) {
    return this.tripsService.create(dto, this.requiredUserId(authorization));
  }

  @Get()
  findAll(@Headers('authorization') authorization?: string) {
    return this.tripsService.findAll(this.optionalUserId(authorization));
  }

  @Get(':id')
  findById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('authorization') authorization?: string
  ) {
    return this.tripsService.findById(id, this.optionalUserId(authorization));
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTripDto,
    @Headers('authorization') authorization?: string
  ) {
    return this.tripsService.update(id, dto, this.optionalUserId(authorization));
  }

  @Delete(':id')
  delete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('authorization') authorization?: string
  ) {
    return this.tripsService.delete(id, this.optionalUserId(authorization));
  }

  @Post(':id/generate-itinerary')
  generateItinerary(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('authorization') authorization?: string
  ) {
    return this.tripsService.generateItinerary(id, this.requiredUserId(authorization));
  }

  private optionalUserId(authorization?: string): string | undefined {
    return authorization
      ? this.authService.resolveUserIdFromAuthorization(authorization)
      : undefined;
  }

  private requiredUserId(authorization?: string): string {
    if (!authorization) {
      throw new UnauthorizedException('Sign in to generate and save trips.');
    }

    return this.authService.resolveUserIdFromAuthorization(authorization);
  }
}
