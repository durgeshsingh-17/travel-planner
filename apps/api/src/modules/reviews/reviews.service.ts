import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Review, ReviewStatus } from '@prisma/client';

import { AuditService } from '../content/audit.service';
import { CreateReviewDto, ReviewTargetDto, UpdateReviewDto } from './dto/review.dto';
import { PrismaService } from '../../database/prisma.service';

const PAGE_SIZE = 10;
const CONTACT_DETAILS = /(\+?\d[\d\s-]{8,}\d)|([^\s@]+@[^\s@]+\.[a-z]{2,})/i;

type Target = { packageId: string } | { destinationId: string } | { placeId: string };

const reviewTargetInclude = {
  package: { select: { slug: true, title: true } },
  destination: { select: { slug: true, name: true } },
  place: { select: { slug: true, name: true, destination: { select: { slug: true } } } }
} satisfies Prisma.ReviewInclude;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /** Approved reviews for a published target, newest first, with a rating summary. */
  async listPublic(query: ReviewTargetDto & { page?: number }) {
    const target = await this.resolveTarget(query, { publishedOnly: true });
    const page = query.page ?? 1;
    const where = { ...target, status: 'APPROVED' as const };
    const [total, reviews, summary, distribution] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE
      }),
      this.prisma.review.aggregate({ where, _avg: { rating: true } }),
      this.prisma.review.groupBy({ by: ['rating'], where, _count: { _all: true } })
    ]);

    return {
      summary: {
        average: summary._avg.rating ? Math.round(summary._avg.rating * 10) / 10 : null,
        count: total,
        distribution: [5, 4, 3, 2, 1].map((stars) => ({
          stars,
          count: distribution.find((entry) => entry.rating === stars)?._count._all ?? 0
        }))
      },
      items: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        title: review.title,
        body: review.body,
        travelledMonth: review.travelledMonth?.toISOString().slice(0, 7) ?? null,
        travellerType: review.travellerType,
        isVerified: review.isVerified,
        createdAt: review.createdAt.toISOString(),
        // First name only: reviews are public.
        author: review.user.name.split(' ')[0]
      })),
      page,
      pageSize: PAGE_SIZE,
      total
    };
  }

  async create(userId: string, dto: CreateReviewDto) {
    this.assertNoContactDetails(dto.title, dto.body);
    const target = await this.resolveTarget(dto, { publishedOnly: true });
    const existing = await this.prisma.review.findFirst({ where: { userId, ...target }, select: { id: true } });

    if (existing) {
      throw new ConflictException({
        message: 'You have already reviewed this. You can edit your review instead.',
        error: { code: 'DUPLICATE_REVIEW', reviewId: existing.id }
      });
    }

    const isVerified =
      'packageId' in target &&
      (await this.prisma.quote.count({
        where: { status: 'ACCEPTED', request: { userId, packageId: target.packageId } }
      })) > 0;

    const review = await this.prisma.review.create({
      data: {
        userId,
        ...target,
        rating: dto.rating,
        title: dto.title?.trim() || null,
        body: dto.body.trim(),
        travelledMonth: dto.travelledMonth ? new Date(`${dto.travelledMonth}-01T00:00:00Z`) : null,
        travellerType: dto.travellerType ?? null,
        isVerified
      },
      include: reviewTargetInclude
    });

    return this.serializeOwn(review);
  }

  /** Authors can edit their review; an edit goes back into moderation. */
  async update(userId: string, id: string, dto: UpdateReviewDto) {
    this.assertNoContactDetails(dto.title, dto.body);
    const review = await this.prisma.review.findFirst({ where: { id, userId } });

    if (!review) {
      throw new NotFoundException(`Review '${id}' was not found`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.review.update({
        where: { id },
        data: {
          rating: dto.rating,
          title: dto.title?.trim() || null,
          body: dto.body.trim(),
          travelledMonth: dto.travelledMonth ? new Date(`${dto.travelledMonth}-01T00:00:00Z`) : null,
          travellerType: dto.travellerType ?? null,
          status: 'PENDING',
          moderationNote: null,
          moderatedAt: null,
          moderatedById: null
        },
        include: reviewTargetInclude
      });
      await this.refreshPackageRating(tx, review.packageId);
      return saved;
    });

    return this.serializeOwn(updated);
  }

  async remove(userId: string, id: string) {
    const review = await this.prisma.review.findFirst({ where: { id, userId }, select: { packageId: true } });

    if (!review) {
      throw new NotFoundException(`Review '${id}' was not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id } });
      await this.refreshPackageRating(tx, review.packageId);
    });

    return { id, deleted: true };
  }

  async mine(userId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { userId },
      include: reviewTargetInclude,
      orderBy: { createdAt: 'desc' }
    });

    return reviews.map((review) => this.serializeOwn(review));
  }

  // ───────────────────────── Moderation ─────────────────────────

  async moderationQueue(status: ReviewStatus = 'PENDING') {
    const reviews = await this.prisma.review.findMany({
      where: { status },
      include: { ...reviewTargetInclude, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
      take: 100
    });

    return reviews.map((review) => ({
      ...this.serializeOwn(review),
      author: review.user
    }));
  }

  async moderate(id: string, decision: 'APPROVED' | 'REJECTED', note: string | undefined, actorId: string) {
    const review = await this.prisma.review.findUnique({ where: { id }, select: { packageId: true } });

    if (!review) {
      throw new NotFoundException(`Review '${id}' was not found`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.review.update({
        where: { id },
        data: {
          status: decision,
          moderationNote: decision === 'REJECTED' ? (note?.trim() ?? null) : null,
          moderatedById: actorId,
          moderatedAt: new Date()
        },
        include: reviewTargetInclude
      });
      await this.refreshPackageRating(tx, review.packageId);
      await this.audit.record(
        { actorId, action: 'MODERATE', entityType: 'REVIEW', entityId: id, summary: decision },
        tx
      );
      return saved;
    });

    return this.serializeOwn(updated);
  }

  // ───────────────────────── Helpers ─────────────────────────

  /** Keeps the denormalised package rating (used for sorting) in step with approved reviews. */
  private async refreshPackageRating(tx: Prisma.TransactionClient, packageId: string | null): Promise<void> {
    if (!packageId) {
      return;
    }

    const result = await tx.review.aggregate({
      where: { packageId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { _all: true }
    });
    await tx.package.update({
      where: { id: packageId },
      data: {
        rating: result._avg.rating ? Math.round(result._avg.rating * 10) / 10 : null,
        reviewCount: result._count._all
      }
    });
  }

  private async resolveTarget(dto: ReviewTargetDto, options: { publishedOnly: boolean }): Promise<Target> {
    const published = options.publishedOnly ? { status: 'PUBLISHED' as const } : {};

    if (dto.packageSlug) {
      const pkg = await this.prisma.package.findFirst({ where: { slug: dto.packageSlug, ...published }, select: { id: true } });
      if (!pkg) throw new NotFoundException(`Package '${dto.packageSlug}' was not found`);
      return { packageId: pkg.id };
    }

    if (dto.destinationSlug && dto.placeSlug) {
      const place = await this.prisma.place.findFirst({
        where: { slug: dto.placeSlug, destination: { slug: dto.destinationSlug, ...published }, ...published },
        select: { id: true }
      });
      if (!place) throw new NotFoundException(`Place '${dto.destinationSlug}/${dto.placeSlug}' was not found`);
      return { placeId: place.id };
    }

    if (dto.destinationSlug) {
      const destination = await this.prisma.destination.findFirst({
        where: { slug: dto.destinationSlug, ...published },
        select: { id: true }
      });
      if (!destination) throw new NotFoundException(`Destination '${dto.destinationSlug}' was not found`);
      return { destinationId: destination.id };
    }

    throw new BadRequestException('Choose a package, destination or place');
  }

  private assertNoContactDetails(title: string | undefined, body: string): void {
    if (CONTACT_DETAILS.test(`${title ?? ''} ${body}`)) {
      throw new BadRequestException('Please remove phone numbers and email addresses from your review.');
    }
  }

  private serializeOwn(review: Review & Prisma.ReviewGetPayload<{ include: typeof reviewTargetInclude }>) {
    return {
      id: review.id,
      status: review.status,
      moderationNote: review.moderationNote,
      rating: review.rating,
      title: review.title,
      body: review.body,
      travelledMonth: review.travelledMonth?.toISOString().slice(0, 7) ?? null,
      travellerType: review.travellerType,
      isVerified: review.isVerified,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
      target: review.package
        ? { type: 'PACKAGE', name: review.package.title, path: `/packages/${review.package.slug}` }
        : review.place
          ? { type: 'PLACE', name: review.place.name, path: `/destinations/${review.place.destination.slug}/places/${review.place.slug}` }
          : { type: 'DESTINATION', name: review.destination?.name ?? '', path: `/destinations/${review.destination?.slug ?? ''}` }
    };
  }
}
