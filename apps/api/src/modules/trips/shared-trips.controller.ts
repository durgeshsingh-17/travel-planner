import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { TripsService } from './trips.service';
import { Public } from '../auth/public.decorator';

@ApiTags('trips')
@Public()
@Controller({
  path: 'shared-trips',
  version: '1'
})
export class SharedTripsController {
  constructor(private readonly tripsService: TripsService) {}

  /** Public, read-only view of a trip its owner chose to share. Omits traveller details. */
  @Get(':shareSlug')
  findShared(@Param('shareSlug') shareSlug: string) {
    return this.tripsService.findShared(shareSlug);
  }
}
