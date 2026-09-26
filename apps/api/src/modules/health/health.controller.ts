import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { HealthService, HealthStatus } from './health.service';
import { Public } from '../auth/public.decorator';

@ApiTags('health')
@Public()
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
}
