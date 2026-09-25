import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

export interface HealthStatus {
  status: 'ok';
  timestamp: string;
  services: {
    api: 'up';
    database: 'up';
  };
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthStatus> {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        api: 'up',
        database: 'up'
      }
    };
  }
}
