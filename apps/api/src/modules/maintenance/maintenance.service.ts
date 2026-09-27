import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../database/prisma.service';
import { expireStale } from '../quotes/quote-status';

const DAY_MS = 24 * 60 * 60 * 1000;
/** OTP rows are only needed for the resend window and audits of recent abuse. */
const OTP_RETENTION_DAYS = 2;
/** Expired refresh tokens are kept a little longer so reuse attempts are still recognised. */
const REFRESH_TOKEN_GRACE_DAYS = 7;

export interface MaintenanceResult {
  otpChallenges: number;
  refreshTokens: number;
  routeCache: number;
}

/**
 * Periodic housekeeping. Every task is an idempotent, indexed delete or
 * update, so running it on several instances at once is safe.
 */
@Injectable()
export class MaintenanceService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  onApplicationBootstrap(): void {
    const minutes = Number.parseInt(this.config.get<string>('MAINTENANCE_INTERVAL_MINUTES') ?? '60', 10);

    // Tests start many short-lived servers; they call run() directly instead.
    if (process.env.NODE_ENV === 'test' || !(minutes > 0)) {
      return;
    }

    this.timer = setInterval(() => void this.runSafely(), minutes * 60_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async run(now = new Date()): Promise<MaintenanceResult> {
    const cacheDays = this.config.get<number>('routing.cacheDays', 30);
    await expireStale(this.prisma);
    const [otpChallenges, refreshTokens, routeCache] = await Promise.all([
      this.prisma.otpChallenge.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - OTP_RETENTION_DAYS * DAY_MS) } } }),
      this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - REFRESH_TOKEN_GRACE_DAYS * DAY_MS) } } }),
      this.prisma.routeCache.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - cacheDays * DAY_MS) } } })
    ]);

    return { otpChallenges: otpChallenges.count, refreshTokens: refreshTokens.count, routeCache: routeCache.count };
  }

  private async runSafely(): Promise<void> {
    try {
      const result = await this.run();
      this.logger.log(`Housekeeping done: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error(`Housekeeping failed: ${(error as Error).message}`);
    }
  }
}
