import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TravelMode } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';

import { Public } from '../auth/public.decorator';
import { RoutingService } from './routing.service';
import { WRITE_THROTTLE } from '../../common/throttle/write.throttle';

export class RouteEstimateQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  fromLat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  fromLng!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  toLat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  toLng!: number;

  @IsOptional()
  @IsEnum(TravelMode)
  mode?: TravelMode;
}

@ApiTags('maps')
@Public()
@Controller({ path: 'routing', version: '1' })
export class RoutingController {
  constructor(private readonly routing: RoutingService) {}

  /** Drive distance and time for the planner preview. Rate-limited: each miss may call the router. */
  @Throttle(WRITE_THROTTLE)
  @Get('estimate')
  estimate(@Query() query: RouteEstimateQueryDto) {
    return this.routing.route(
      { latitude: query.fromLat, longitude: query.fromLng },
      { latitude: query.toLat, longitude: query.toLng },
      query.mode ?? 'CAR'
    );
  }
}
