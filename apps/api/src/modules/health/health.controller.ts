import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';

import { HealthService, HealthStatus } from './health.service';
import { Public } from '../auth/public.decorator';

@ApiTags('health')
@Public()
// Load balancers poll these constantly.
@SkipThrottle()
@Controller({
  path: 'health',
  version: '1'
})
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }

  @Get('live')
  live() {
    return this.healthService.live();
  }

  @Get('ready')
  ready(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
