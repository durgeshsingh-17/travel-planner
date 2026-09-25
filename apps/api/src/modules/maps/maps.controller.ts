import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { MapsService } from './maps.service';
import { RouteQueryDto } from './dto/route-query.dto';

@ApiTags('maps')
@Controller({
  path: 'maps',
  version: '1'
})
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('status')
  status() {
    return this.mapsService.status();
  }

  @Get('route')
  route(@Query() query: RouteQueryDto) {
    return this.mapsService.route(query);
  }
}
