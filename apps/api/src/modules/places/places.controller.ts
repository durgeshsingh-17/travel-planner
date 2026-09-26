import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ListPlacesQueryDto } from './dto/list-places-query.dto';
import { PlacesService } from './places.service';
import { Public } from '../auth/public.decorator';

@ApiTags('places')
@Public()
@Controller({
  path: 'places',
  version: '1'
})
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  findAll(@Query() query: ListPlacesQueryDto) {
    return this.placesService.findAll(query);
  }
}
