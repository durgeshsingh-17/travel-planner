import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { DestinationsService } from './destinations.service';

@ApiTags('destinations')
@Controller({
  path: 'destinations',
  version: '1'
})
export class DestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  @Get()
  findAll(
    @Query('state') state?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string
  ) {
    return this.destinationsService.findAll({
      state,
      q,
      limit: this.parseLimit(limit)
    });
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.destinationsService.findBySlug(slug);
  }

  private parseLimit(limit?: string): number | undefined {
    if (!limit) {
      return undefined;
    }

    const parsedLimit = Number(limit);
    return Number.isInteger(parsedLimit) ? parsedLimit : undefined;
  }
}
