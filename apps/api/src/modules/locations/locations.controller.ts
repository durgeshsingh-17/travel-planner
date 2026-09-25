import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { LocationsService } from './locations.service';

@ApiTags('locations')
@Controller({
  path: 'locations',
  version: '1'
})
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  findAll(
    @Query('q') q?: string,
    @Query('state') state?: string,
    @Query('limit') limit?: string
  ) {
    return this.locationsService.findAll({
      q,
      state,
      limit: this.parseLimit(limit)
    });
  }

  private parseLimit(limit?: string): number | undefined {
    if (!limit) {
      return undefined;
    }

    const parsedLimit = Number(limit);
    return Number.isInteger(parsedLimit) ? parsedLimit : undefined;
  }
}
