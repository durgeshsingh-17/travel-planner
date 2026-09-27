import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DeclineRequestDto, SubmitQuoteDto } from './dto/quote-request.dto';
import { MAX_QUOTE_VALIDITY_DAYS, OPEN_REQUEST_STATUSES, expireStale } from './quote-status';
import { PrismaService } from '../../database/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What an agency sees and does. Used by agency users (their own agency) and by
 * admins entering a quote on an agency's behalf.
 */
@Injectable()
export class AgentQuotesService {
  constructor(private readonly prisma: PrismaService) {}

  async agentForUser(userId: string): Promise<{ id: string; displayName: string }> {
    const agent = await this.prisma.agent.findUnique({ where: { userId }, select: { id: true, displayName: true, isActive: true } });

    if (!agent || !agent.isActive) {
      throw new ForbiddenException('Your account is not linked to an active agency.');
    }

    return agent;
  }

  async inbox(agentId: string) {
    await expireStale(this.prisma);
    const routings = await this.prisma.quoteRequestAgent.findMany({
      where: { agentId },
      include: {
        request: {
          include: {
            package: { select: { title: true, slug: true } },
            destination: { select: { name: true } },
            quotes: { where: { agentId }, select: { id: true, status: true, totalPrice: true } }
          }
        }
      },
      orderBy: { notifiedAt: 'desc' },
      take: 200
    });

    return routings.map((routing) => ({
      requestId: routing.quoteRequestId,
      routingStatus: routing.status,
      notifiedAt: routing.notifiedAt.toISOString(),
      requestStatus: routing.request.status,
      expiresAt: routing.request.expiresAt.toISOString(),
      package: routing.request.package,
      destination: routing.request.destination,
      startDate: routing.request.startDate?.toISOString().slice(0, 10) ?? null,
      flexibleMonth: routing.request.flexibleMonth,
      nights: routing.request.nights,
      travellers: routing.request.adults + routing.request.childAges.length,
      myQuote: routing.request.quotes[0] ?? null
    }));
  }

  /** Opening a request marks it viewed. Contact details are shared: the traveller consented to that. */
  async request(agentId: string, requestId: string) {
    await expireStale(this.prisma);
    const routing = await this.routingOrThrow(agentId, requestId);

    if (routing.status === 'NOTIFIED') {
      await this.prisma.quoteRequestAgent.update({
        where: { quoteRequestId_agentId: { quoteRequestId: requestId, agentId } },
        data: { status: 'VIEWED', viewedAt: new Date() }
      });
    }

    const request = await this.prisma.quoteRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: {
        package: {
          select: {
            slug: true,
            title: true,
            durationDays: true,
            durationNights: true,
            destinations: { orderBy: { sortOrder: 'asc' }, select: { nights: true, destination: { select: { name: true } } } }
          }
        },
        destination: { select: { name: true, state: true } },
        departureLocation: { select: { name: true, state: true } },
        quotes: { where: { agentId } }
      }
    });

    return {
      id: request.id,
      status: request.status,
      routingStatus: routing.status === 'NOTIFIED' ? 'VIEWED' : routing.status,
      expiresAt: request.expiresAt.toISOString(),
      package: request.package
        ? {
            slug: request.package.slug,
            title: request.package.title,
            durationDays: request.package.durationDays,
            durationNights: request.package.durationNights,
            route: request.package.destinations.map((stop) => `${stop.destination.name} ${stop.nights}N`).join(' → ')
          }
        : null,
      packageTier: request.packageTier,
      destination: request.destination,
      departureLocation: request.departureLocation,
      startDate: request.startDate?.toISOString().slice(0, 10) ?? null,
      flexibleMonth: request.flexibleMonth,
      nights: request.nights,
      adults: request.adults,
      childAges: request.childAges,
      rooms: request.rooms,
      budgetPerPersonMin: request.budgetPerPersonMin,
      budgetPerPersonMax: request.budgetPerPersonMax,
      hotelCategory: request.hotelCategory,
      notes: request.notes,
      contactName: request.contactName,
      contactPhone: request.contactPhone,
      contactEmail: request.contactEmail,
      myQuote: request.quotes[0]
        ? { ...request.quotes[0], validUntil: request.quotes[0].validUntil.toISOString(), createdAt: request.quotes[0].createdAt.toISOString() }
        : null
    };
  }

  async submitQuote(agentId: string, requestId: string, dto: SubmitQuoteDto, createdByUserId: string) {
    await expireStale(this.prisma);
    const routing = await this.routingOrThrow(agentId, requestId);
    const request = await this.prisma.quoteRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { status: true, adults: true, childAges: true }
    });

    if (!OPEN_REQUEST_STATUSES.includes(request.status)) {
      throw new ConflictException(`This request is ${request.status.toLowerCase()} and no longer takes quotes.`);
    }

    if (routing.status === 'DECLINED') {
      throw new ConflictException('You declined this request.');
    }

    if (routing.status === 'QUOTED') {
      throw new ConflictException('You have already sent a quote for this request.');
    }

    const validUntil = new Date(dto.validUntil);
    const now = Date.now();

    if (validUntil.getTime() <= now || validUntil.getTime() > now + MAX_QUOTE_VALIDITY_DAYS * DAY_MS) {
      throw new BadRequestException(`Quotes must be valid for between today and ${MAX_QUOTE_VALIDITY_DAYS} days.`);
    }

    const travellers = request.adults + request.childAges.length;
    const pricePerPerson = dto.pricePerPerson ?? Math.ceil(dto.totalPrice / travellers);

    await this.prisma.$transaction([
      this.prisma.quote.create({
        data: {
          quoteRequestId: requestId,
          agentId,
          tier: dto.tier ?? null,
          totalPrice: dto.totalPrice,
          pricePerPerson,
          taxesIncluded: dto.taxesIncluded ?? false,
          hotels: dto.hotels as unknown as Prisma.InputJsonValue,
          inclusions: dto.inclusions.map((item) => item.trim()).filter(Boolean),
          exclusions: (dto.exclusions ?? []).map((item) => item.trim()).filter(Boolean),
          message: dto.message?.trim() || null,
          validUntil,
          createdByUserId
        }
      }),
      this.prisma.quoteRequestAgent.update({
        where: { quoteRequestId_agentId: { quoteRequestId: requestId, agentId } },
        data: { status: 'QUOTED', respondedAt: new Date() }
      }),
      this.prisma.quoteRequest.update({ where: { id: requestId }, data: { status: 'QUOTED' } })
    ]);

    return this.request(agentId, requestId);
  }

  async decline(agentId: string, requestId: string, dto: DeclineRequestDto) {
    const routing = await this.routingOrThrow(agentId, requestId);

    if (routing.status === 'QUOTED') {
      throw new ConflictException('You have already sent a quote for this request.');
    }

    await this.prisma.quoteRequestAgent.update({
      where: { quoteRequestId_agentId: { quoteRequestId: requestId, agentId } },
      data: { status: 'DECLINED', respondedAt: new Date(), declineReason: dto.reason.trim() }
    });

    return { requestId, declined: true };
  }

  private async routingOrThrow(agentId: string, requestId: string) {
    const routing = await this.prisma.quoteRequestAgent.findUnique({
      where: { quoteRequestId_agentId: { quoteRequestId: requestId, agentId } }
    });

    if (!routing) {
      // Requests not routed to this agency do not exist as far as it is concerned.
      throw new NotFoundException(`Quote request '${requestId}' was not found`);
    }

    return routing;
  }
}
