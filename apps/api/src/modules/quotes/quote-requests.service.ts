import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CreateQuoteRequestDto } from './dto/quote-request.dto';
import { OPEN_REQUEST_STATUSES, REQUEST_TTL_DAYS, expireStale } from './quote-status';
import { PrismaService } from '../../database/prisma.service';
import { QuoteRoutingService } from './quote-routing.service';

const DUPLICATE_WINDOW_DAYS = 7;
const MAX_MONTHS_AHEAD = 18;
const DAY_MS = 24 * 60 * 60 * 1000;

export const requestInclude = {
  package: { select: { slug: true, title: true, durationDays: true, durationNights: true } },
  destination: { select: { slug: true, name: true, state: true } },
  departureLocation: { select: { slug: true, name: true, state: true } },
  routings: { select: { status: true } },
  quotes: {
    orderBy: { totalPrice: 'asc' },
    include: { agent: { select: { id: true, displayName: true, city: true, email: true, phone: true } } }
  }
} satisfies Prisma.QuoteRequestInclude;

export type RequestWithRelations = Prisma.QuoteRequestGetPayload<{ include: typeof requestInclude }>;

/** Today's date in India as YYYY-MM-DD. */
export function indiaToday(now = new Date()): string {
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

@Injectable()
export class QuoteRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routing: QuoteRoutingService
  ) {}

  async create(userId: string, dto: CreateQuoteRequestDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { phone: true, phoneVerifiedAt: true }
    });

    if (!user.phone || !user.phoneVerifiedAt) {
      throw new BadRequestException({
        message: 'Verify your mobile number before requesting quotes.',
        error: { code: 'PHONE_NOT_VERIFIED' }
      });
    }

    this.assertTravelDetails(dto);
    const pkg = dto.packageSlug
      ? await this.prisma.package.findFirst({
          where: { slug: dto.packageSlug, status: 'PUBLISHED' },
          select: {
            id: true,
            tiers: { select: { level: true } },
            destinations: { orderBy: { sortOrder: 'asc' }, select: { destinationId: true, destination: { select: { state: true } } } }
          }
        })
      : null;

    if (dto.packageSlug && !pkg) {
      throw new NotFoundException(`Package '${dto.packageSlug}' was not found`);
    }

    if (dto.packageTier && pkg && !pkg.tiers.some((tier) => tier.level === dto.packageTier)) {
      throw new BadRequestException(`This package does not offer the ${dto.packageTier} tier`);
    }

    const destination = dto.destinationSlug
      ? await this.prisma.destination.findFirst({
          where: { slug: dto.destinationSlug, status: 'PUBLISHED' },
          select: { id: true, state: true }
        })
      : null;

    if (dto.destinationSlug && !destination) {
      throw new NotFoundException(`Destination '${dto.destinationSlug}' was not found`);
    }

    const departure = dto.departureLocationSlug
      ? await this.prisma.location.findFirst({ where: { slug: dto.departureLocationSlug, isActive: true }, select: { id: true } })
      : null;

    if (dto.departureLocationSlug && !departure) {
      throw new BadRequestException('Departure city was not found');
    }

    const destinationId = destination?.id ?? pkg?.destinations[0]?.destinationId ?? null;
    const states = [
      ...new Set([...(destination ? [destination.state] : []), ...(pkg?.destinations.map((stop) => stop.destination.state) ?? [])])
    ];

    await expireStale(this.prisma);
    const duplicate = await this.prisma.quoteRequest.findFirst({
      where: {
        userId,
        status: { in: OPEN_REQUEST_STATUSES },
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_DAYS * DAY_MS) },
        ...(pkg ? { packageId: pkg.id } : { packageId: null, destinationId })
      },
      select: { id: true }
    });

    if (duplicate) {
      throw new ConflictException({
        message: 'You already have an open request for this trip. You can follow it in My quotes.',
        error: { code: 'DUPLICATE_REQUEST', requestId: duplicate.id }
      });
    }

    const now = new Date();
    const id = await this.prisma.$transaction(async (tx) => {
      const request = await tx.quoteRequest.create({
        data: {
          userId,
          packageId: pkg?.id ?? null,
          packageTier: dto.packageTier ?? null,
          destinationId,
          departureLocationId: departure?.id ?? null,
          startDate: dto.startDate ? new Date(`${dto.startDate}T00:00:00.000Z`) : null,
          flexibleMonth: dto.startDate ? null : (dto.flexibleMonth ?? null),
          nights: dto.nights,
          adults: dto.adults,
          childAges: dto.childAges ?? [],
          rooms: dto.rooms,
          budgetPerPersonMin: dto.budgetPerPersonMin ?? null,
          budgetPerPersonMax: dto.budgetPerPersonMax ?? null,
          hotelCategory: dto.hotelCategory ?? null,
          notes: dto.notes?.trim() || null,
          contactName: dto.contactName.trim(),
          contactPhone: user.phone!,
          contactEmail: dto.contactEmail?.trim().toLowerCase() ?? null,
          phoneVerifiedAt: user.phoneVerifiedAt!,
          consentAt: now,
          source: dto.source ?? (pkg ? 'PACKAGE' : 'DESTINATION'),
          expiresAt: new Date(now.getTime() + REQUEST_TTL_DAYS * DAY_MS)
        },
        select: { id: true }
      });
      await this.routing.route(tx, request.id, states);
      return request.id;
    });

    return this.get(userId, id);
  }

  async list(userId: string) {
    await expireStale(this.prisma);
    const requests = await this.prisma.quoteRequest.findMany({
      where: { userId },
      include: requestInclude,
      orderBy: { createdAt: 'desc' }
    });

    return requests.map((request) => this.summary(request));
  }

  async get(userId: string, id: string) {
    await expireStale(this.prisma);
    const request = await this.prisma.quoteRequest.findFirst({ where: { id, userId }, include: requestInclude });

    if (!request) {
      throw new NotFoundException(`Quote request '${id}' was not found`);
    }

    return this.detail(request);
  }

  async cancel(userId: string, id: string) {
    const request = await this.prisma.quoteRequest.findFirst({ where: { id, userId }, select: { status: true } });

    if (!request) {
      throw new NotFoundException(`Quote request '${id}' was not found`);
    }

    if (!OPEN_REQUEST_STATUSES.includes(request.status)) {
      throw new ConflictException(`This request is already ${request.status.toLowerCase()}.`);
    }

    await this.prisma.$transaction([
      this.prisma.quoteRequest.update({ where: { id }, data: { status: 'CANCELLED', closedReason: 'Cancelled by traveller' } }),
      this.prisma.quote.updateMany({ where: { quoteRequestId: id, status: 'SENT' }, data: { status: 'REJECTED' } })
    ]);

    return this.get(userId, id);
  }

  /** Accepting one quote declines the others and closes the request to new quotes. */
  async accept(userId: string, quoteId: string) {
    await expireStale(this.prisma);
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, request: { userId } },
      select: { id: true, status: true, quoteRequestId: true, request: { select: { status: true } } }
    });

    if (!quote) {
      throw new NotFoundException(`Quote '${quoteId}' was not found`);
    }

    if (quote.status !== 'SENT') {
      throw new ConflictException(`This quote is ${quote.status.toLowerCase()} and cannot be accepted.`);
    }

    if (!OPEN_REQUEST_STATUSES.includes(quote.request.status)) {
      throw new ConflictException(`This request is already ${quote.request.status.toLowerCase()}.`);
    }

    await this.prisma.$transaction([
      this.prisma.quote.update({ where: { id: quoteId }, data: { status: 'ACCEPTED' } }),
      this.prisma.quote.updateMany({
        where: { quoteRequestId: quote.quoteRequestId, id: { not: quoteId }, status: 'SENT' },
        data: { status: 'REJECTED' }
      }),
      this.prisma.quoteRequest.update({ where: { id: quote.quoteRequestId }, data: { status: 'ACCEPTED' } })
    ]);

    return this.get(userId, quote.quoteRequestId);
  }

  async decline(userId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, request: { userId } },
      select: { status: true, quoteRequestId: true }
    });

    if (!quote) {
      throw new NotFoundException(`Quote '${quoteId}' was not found`);
    }

    if (quote.status !== 'SENT') {
      throw new ConflictException(`This quote is already ${quote.status.toLowerCase()}.`);
    }

    await this.prisma.quote.update({ where: { id: quoteId }, data: { status: 'REJECTED' } });
    return this.get(userId, quote.quoteRequestId);
  }

  // ───────────────────────── Serialisation ─────────────────────────

  summary(request: RequestWithRelations) {
    return {
      id: request.id,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      expiresAt: request.expiresAt.toISOString(),
      package: request.package,
      packageTier: request.packageTier,
      destination: request.destination,
      startDate: request.startDate?.toISOString().slice(0, 10) ?? null,
      flexibleMonth: request.flexibleMonth,
      nights: request.nights,
      adults: request.adults,
      children: request.childAges.length,
      agenciesContacted: request.routings.length,
      quotesReceived: request.quotes.length
    };
  }

  detail(request: RequestWithRelations) {
    const quotes = request.quotes.map((quote) => {
      const accepted = quote.status === 'ACCEPTED';
      return {
        id: quote.id,
        status: quote.status,
        tier: quote.tier,
        totalPrice: quote.totalPrice,
        pricePerPerson: quote.pricePerPerson,
        taxesIncluded: quote.taxesIncluded,
        hotels: quote.hotels as Array<Record<string, unknown>>,
        inclusions: quote.inclusions,
        exclusions: quote.exclusions,
        message: quote.message,
        validUntil: quote.validUntil.toISOString(),
        createdAt: quote.createdAt.toISOString(),
        agent: {
          id: quote.agent.id,
          displayName: quote.agent.displayName,
          city: quote.agent.city,
          // Contact details are shared once the traveller accepts this agency's quote.
          email: accepted ? quote.agent.email : null,
          phone: accepted ? quote.agent.phone : null
        }
      };
    });

    return {
      ...this.summary(request),
      departureLocation: request.departureLocation,
      childAges: request.childAges,
      rooms: request.rooms,
      budgetPerPersonMin: request.budgetPerPersonMin,
      budgetPerPersonMax: request.budgetPerPersonMax,
      hotelCategory: request.hotelCategory,
      notes: request.notes,
      contactName: request.contactName,
      contactPhone: request.contactPhone,
      contactEmail: request.contactEmail,
      closedReason: request.closedReason,
      agenciesDeclined: request.routings.filter((routing) => routing.status === 'DECLINED').length,
      quotes,
      comparison: this.compare(quotes)
    };
  }

  /**
   * Side-by-side view: which inclusions each quote covers (most common first)
   * and which live quote is cheapest per person.
   */
  compare(quotes: Array<{ id: string; status: string; pricePerPerson: number; inclusions: string[] }>) {
    const live = quotes.filter((quote) => quote.status === 'SENT' || quote.status === 'ACCEPTED');
    const counts = new Map<string, { label: string; count: number }>();

    live.forEach((quote) =>
      quote.inclusions.forEach((item) => {
        const key = item.trim().toLowerCase();
        const entry = counts.get(key) ?? { label: item.trim(), count: 0 };
        entry.count += 1;
        counts.set(key, entry);
      })
    );

    const cheapest = [...live].sort((a, b) => a.pricePerPerson - b.pricePerPerson)[0];

    return {
      cheapestQuoteId: cheapest?.id ?? null,
      inclusions: [...counts.entries()]
        .sort((a, b) => b[1].count - a[1].count || a[1].label.localeCompare(b[1].label))
        .map(([key, entry]) => ({
          item: entry.label,
          coveredBy: live
            .filter((quote) => quote.inclusions.some((inclusion) => inclusion.trim().toLowerCase() === key))
            .map((quote) => quote.id)
        }))
    };
  }

  private assertTravelDetails(dto: CreateQuoteRequestDto): void {
    const problems: string[] = [];
    const today = indiaToday();

    if (dto.startDate) {
      const latest = new Date(`${today}T00:00:00Z`);
      latest.setUTCMonth(latest.getUTCMonth() + MAX_MONTHS_AHEAD);

      if (dto.startDate < today) problems.push('Start date cannot be in the past');
      if (dto.startDate > latest.toISOString().slice(0, 10)) problems.push(`Start date must be within ${MAX_MONTHS_AHEAD} months`);
    }

    const children = dto.childAges?.length ?? 0;
    if (dto.adults + children > 30) problems.push('For groups larger than 30, please contact us directly');
    if (dto.rooms > dto.adults + children) problems.push('Rooms cannot exceed the number of travellers');

    if (
      dto.budgetPerPersonMin !== undefined &&
      dto.budgetPerPersonMax !== undefined &&
      dto.budgetPerPersonMin > dto.budgetPerPersonMax
    ) {
      problems.push('Minimum budget cannot be higher than the maximum');
    }

    if (problems.length) {
      throw new BadRequestException(problems.join('; '));
    }
  }
}
