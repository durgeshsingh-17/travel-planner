import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { MAX_AGENTS_PER_REQUEST, OPEN_REQUEST_STATUSES } from './quote-status';

type Tx = Prisma.TransactionClient;

/**
 * Chooses up to three active agencies for a request: they must serve one of the
 * trip's states (or all of India) and be under their open-lead limit. The
 * least recently routed agencies go first, so leads rotate fairly.
 */
@Injectable()
export class QuoteRoutingService {
  async route(tx: Tx, requestId: string, states: string[], limit = MAX_AGENTS_PER_REQUEST): Promise<string[]> {
    const already = await tx.quoteRequestAgent.findMany({ where: { quoteRequestId: requestId }, select: { agentId: true } });
    const exclude = already.map((routing) => routing.agentId);
    const slots = limit - exclude.length;

    if (slots <= 0) {
      return [];
    }

    const candidates = await tx.agent.findMany({
      where: {
        isActive: true,
        id: { notIn: exclude },
        OR: [{ serviceStates: { isEmpty: true } }, ...(states.length ? [{ serviceStates: { hasSome: states } }] : [])]
      },
      select: {
        id: true,
        maxOpenLeads: true,
        _count: {
          select: {
            routings: {
              where: {
                status: { in: ['NOTIFIED', 'VIEWED'] },
                request: { status: { in: OPEN_REQUEST_STATUSES } }
              }
            }
          }
        }
      },
      orderBy: [{ lastRoutedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }]
    });
    const chosen = candidates
      .filter((agent) => agent._count.routings < agent.maxOpenLeads)
      .slice(0, slots)
      .map((agent) => agent.id);

    if (chosen.length) {
      await tx.quoteRequestAgent.createMany({
        data: chosen.map((agentId) => ({ quoteRequestId: requestId, agentId }))
      });
      await tx.agent.updateMany({ where: { id: { in: chosen } }, data: { lastRoutedAt: new Date() } });
      await tx.quoteRequest.updateMany({
        where: { id: requestId, status: 'NEW' },
        data: { status: 'ROUTED' }
      });
    }

    return chosen;
  }

  /** Assigns specific agencies (admin override), still capped at three per request. */
  async assign(tx: Tx, requestId: string, agentIds: string[]): Promise<string[]> {
    const already = await tx.quoteRequestAgent.findMany({ where: { quoteRequestId: requestId }, select: { agentId: true } });
    const existing = new Set(already.map((routing) => routing.agentId));
    const fresh = [...new Set(agentIds)].filter((id) => !existing.has(id)).slice(0, MAX_AGENTS_PER_REQUEST - existing.size);

    if (fresh.length) {
      await tx.quoteRequestAgent.createMany({ data: fresh.map((agentId) => ({ quoteRequestId: requestId, agentId })) });
      await tx.agent.updateMany({ where: { id: { in: fresh } }, data: { lastRoutedAt: new Date() } });
      await tx.quoteRequest.updateMany({ where: { id: requestId, status: 'NEW' }, data: { status: 'ROUTED' } });
    }

    return fresh;
  }
}
