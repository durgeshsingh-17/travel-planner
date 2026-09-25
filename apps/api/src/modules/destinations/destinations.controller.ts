import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ListDestinationsQueryDto } from './dto/list-destinations-query.dto';
import { DestinationsService } from './destinations.service';

@ApiTags('destinations')
@Controller({
  path: 'destinations',
  version: '1'
})
export class DestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  @Get()
  findAll(@Query() query: ListDestinationsQueryDto) {
    return this.destinationsService.findAll(query);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.destinationsService.findBySlug(slug);
  }
}
