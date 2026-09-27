import { Prisma, QuoteRequestStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

/** Requests still waiting for quotes or a decision. */
export const OPEN_REQUEST_STATUSES: QuoteRequestStatus[] = ['NEW', 'ROUTED', 'QUOTED'];
export const REQUEST_TTL_DAYS = 14;
export const MAX_AGENTS_PER_REQUEST = 3;
export const MAX_QUOTE_VALIDITY_DAYS = 60;

/**
 * Marks requests and quotes past their deadline as expired. There is no job
 * scheduler yet, so every read path calls this first; it is a cheap indexed update.
 */
export async function expireStale(prisma: PrismaService | Prisma.TransactionClient): Promise<void> {
  const now = new Date();
  await prisma.quoteRequest.updateMany({
    where: { status: { in: OPEN_REQUEST_STATUSES }, expiresAt: { lt: now } },
    data: { status: 'EXPIRED' }
  });
  await prisma.quote.updateMany({
    where: { status: 'SENT', validUntil: { lt: now } },
    data: { status: 'EXPIRED' }
  });
}
