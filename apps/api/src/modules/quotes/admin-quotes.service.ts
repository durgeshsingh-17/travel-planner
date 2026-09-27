import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, QuoteRequestStatus } from '@prisma/client';

import { AgentDto } from './dto/agent.dto';
import { AuditService } from '../content/audit.service';
import { OPEN_REQUEST_STATUSES, expireStale } from './quote-status';
import { PrismaService } from '../../database/prisma.service';
import { QuoteRequestsService, requestInclude } from './quote-requests.service';
import { QuoteRoutingService } from './quote-routing.service';
import { toE164India } from '../verification/otp.service';

@Injectable()
export class AdminQuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routing: QuoteRoutingService,
    private readonly requests: QuoteRequestsService,
    private readonly audit: AuditService
  ) {}

  // ───────────────────────── Agencies ─────────────────────────

  async listAgents() {
    const agents = await this.prisma.agent.findMany({
      include: {
        user: { select: { email: true } },
        _count: { select: { routings: true, quotes: true } },
        quotes: { where: { status: 'ACCEPTED' }, select: { id: true } }
      },
      orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }]
    });

    return agents.map(({ user, _count, quotes, ...agent }) => ({
      ...agent,
      lastRoutedAt: agent.lastRoutedAt?.toISOString() ?? null,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
      userEmail: user?.email ?? null,
      requestsReceived: _count.routings,
      quotesSent: _count.quotes,
      quotesAccepted: quotes.length
    }));
  }

  async saveAgent(dto: AgentDto, actorId: string, id?: string) {
    const clash = await this.prisma.agent.findFirst({
      where: { slug: dto.slug, ...(id ? { id: { not: id } } : {}) },
      select: { id: true }
    });

    if (clash) {
      throw new ConflictException(`An agency with slug '${dto.slug}' already exists`);
    }

    let userId: string | null | undefined;

    if (dto.userEmail) {
      const user = await this.prisma.user.findUnique({ where: { email: dto.userEmail.toLowerCase() }, select: { id: true, role: true } });

      if (!user) {
        throw new BadRequestException('No account exists with that email. Ask them to sign up first.');
      }

      if (user.role === 'ADMIN' || user.role === 'EDITOR') {
        throw new BadRequestException('Staff accounts cannot be linked to an agency.');
      }

      userId = user.id;
    } else if (dto.userEmail === null) {
      userId = null;
    }

    const data = {
      slug: dto.slug,
      displayName: dto.displayName.trim(),
      email: dto.email.toLowerCase(),
      phone: toE164India(dto.phone),
      city: dto.city ?? null,
      serviceStates: [...new Set((dto.serviceStates ?? []).map((state) => state.trim()).filter(Boolean))],
      isActive: dto.isActive ?? true,
      maxOpenLeads: dto.maxOpenLeads ?? 20,
      notes: dto.notes ?? null,
      ...(userId !== undefined ? { userId } : {})
    };

    const agent = await this.prisma.$transaction(async (tx) => {
      const previous = id ? await tx.agent.findUniqueOrThrow({ where: { id }, select: { userId: true } }) : null;
      const saved = id ? await tx.agent.update({ where: { id }, data }) : await tx.agent.create({ data });

      // The linked login gets the AGENT role; an unlinked one goes back to traveller.
      if (userId) {
        await tx.user.update({ where: { id: userId }, data: { role: 'AGENT' } });
      }

      if (previous?.userId && previous.userId !== saved.userId) {
        await tx.user.updateMany({ where: { id: previous.userId, role: 'AGENT' }, data: { role: 'TRAVELLER' } });
      }

      await this.audit.record(
        { actorId, action: id ? 'UPDATE' : 'CREATE', entityType: 'AGENT', entityId: saved.id, summary: saved.displayName },
        tx
      );
      return saved;
    });

    return agent;
  }

  // ───────────────────────── Requests ─────────────────────────

  async listRequests(status?: QuoteRequestStatus) {
    await expireStale(this.prisma);
    const requests = await this.prisma.quoteRequest.findMany({
      where: { status },
      include: {
        ...requestInclude,
        user: { select: { name: true, email: true } },
        routings: { select: { status: true, agent: { select: { displayName: true } } } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    return requests.map((request) => ({
      ...this.requests.summary(request as never),
      traveller: request.user,
      routings: request.routings.map((routing) => ({ agent: routing.agent.displayName, status: routing.status })),
      unrouted: request.routings.length === 0
    }));
  }

  async getRequest(id: string) {
    await expireStale(this.prisma);
    const request = await this.prisma.quoteRequest.findUnique({
      where: { id },
      include: {
        ...requestInclude,
        routings: {
          select: {
            status: true,
            notifiedAt: true,
            viewedAt: true,
            respondedAt: true,
            declineReason: true,
            agent: { select: { id: true, displayName: true } }
          }
        }
      }
    });

    if (!request) {
      throw new NotFoundException(`Quote request '${id}' was not found`);
    }

    return {
      ...this.requests.detail(request as never),
      routings: request.routings.map((routing) => ({
        ...routing,
        notifiedAt: routing.notifiedAt.toISOString(),
        viewedAt: routing.viewedAt?.toISOString() ?? null,
        respondedAt: routing.respondedAt?.toISOString() ?? null
      }))
    };
  }

  /** Admin override: send to specific agencies, or re-run automatic routing when none are given. */
  async route(id: string, agentIds: string[], actorId: string) {
    const request = await this.prisma.quoteRequest.findUnique({
      where: { id },
      select: {
        status: true,
        destination: { select: { state: true } },
        package: { select: { destinations: { select: { destination: { select: { state: true } } } } } }
      }
    });

    if (!request) {
      throw new NotFoundException(`Quote request '${id}' was not found`);
    }

    if (!OPEN_REQUEST_STATUSES.includes(request.status)) {
      throw new ConflictException(`This request is ${request.status.toLowerCase()}.`);
    }

    const assigned = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (agentIds.length) {
        const active = await tx.agent.findMany({ where: { id: { in: agentIds }, isActive: true }, select: { id: true } });
        return this.routing.assign(tx, id, active.map((agent) => agent.id));
      }

      const states = [
        ...new Set([
          ...(request.destination ? [request.destination.state] : []),
          ...(request.package?.destinations.map((stop) => stop.destination.state) ?? [])
        ])
      ];
      return this.routing.route(tx, id, states);
    });
    await this.audit.record({
      actorId,
      action: 'ROUTE',
      entityType: 'QUOTE_REQUEST',
      entityId: id,
      summary: `Routed to ${assigned.length} agencies`
    });

    return this.getRequest(id);
  }
}
