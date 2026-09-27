import { Injectable, ServiceUnavailableException } from '@nestjs/common';

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

  /** Liveness: the process is up and serving. No dependencies, so it never flaps. */
  live() {
    return { status: 'ok' as const, uptimeSeconds: Math.round(process.uptime()) };
  }

  /** Readiness: safe to send traffic. 503 while the database is unreachable. */
  async check(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database is not reachable');
    }

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
