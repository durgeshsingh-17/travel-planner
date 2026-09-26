import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Media, Prisma } from '@prisma/client';

import { AuditService } from '../content/audit.service';
import { MediaMetadataDto, RegisterExternalMediaDto } from './dto/admin.dto';
import { MediaStorageService } from '../content/media-storage.service';
import { PrismaService } from '../../database/prisma.service';
import { mediaUrl } from '../content/shared/media-url';

const PAGE_SIZE = 40;

@Injectable()
export class AdminMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorageService,
    private readonly audit: AuditService
  ) {}

  async list(query: { q?: string; page?: number }) {
    const page = query.page ?? 1;
    const where: Prisma.MediaWhereInput = query.q
      ? {
          OR: [
            { altText: { contains: query.q, mode: 'insensitive' } },
            { credit: { contains: query.q, mode: 'insensitive' } }
          ]
        }
      : {};
    const [total, items] = await this.prisma.$transaction([
      this.prisma.media.count({ where }),
      this.prisma.media.findMany({
        where,
        include: { _count: { select: { attachments: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE
      })
    ]);

    return {
      items: items.map(({ _count, ...media }) => ({ ...this.serialize(media), usageCount: _count.attachments })),
      page,
      pageSize: PAGE_SIZE,
      total
    };
  }

  async upload(file: Express.Multer.File | undefined, metadata: MediaMetadataDto, actorId: string) {
    if (!file) {
      throw new NotFoundException('Attach an image in the "file" field');
    }

    const stored = await this.storage.save(file.buffer);

    try {
      const media = await this.prisma.media.create({
        data: {
          ...stored,
          altText: metadata.altText.trim(),
          credit: metadata.credit ?? null,
          license: metadata.license,
          sourceUrl: metadata.sourceUrl ?? null,
          uploadedById: actorId
        }
      });
      await this.audit.record({ actorId, action: 'CREATE', entityType: 'MEDIA', entityId: media.id, summary: media.altText });
      return this.serialize(media);
    } catch (error) {
      await this.storage.remove(stored.storageKey);
      throw error;
    }
  }

  async registerExternal(dto: RegisterExternalMediaDto, actorId: string) {
    const existing = await this.prisma.media.findFirst({ where: { url: dto.url } });

    if (existing) {
      return this.serialize(existing);
    }

    const media = await this.prisma.media.create({
      data: {
        url: dto.url,
        sourceUrl: dto.sourceUrl ?? dto.url,
        altText: dto.altText.trim(),
        credit: dto.credit ?? null,
        license: dto.license,
        width: dto.width ?? null,
        height: dto.height ?? null,
        uploadedById: actorId
      }
    });
    await this.audit.record({ actorId, action: 'CREATE', entityType: 'MEDIA', entityId: media.id, summary: media.altText });
    return this.serialize(media);
  }

  async update(id: string, dto: MediaMetadataDto, actorId: string) {
    const media = await this.prisma.media.update({
      where: { id },
      data: {
        altText: dto.altText.trim(),
        credit: dto.credit ?? null,
        license: dto.license,
        sourceUrl: dto.sourceUrl ?? undefined
      }
    });
    await this.audit.record({ actorId, action: 'UPDATE', entityType: 'MEDIA', entityId: id, summary: media.altText });
    return this.serialize(media);
  }

  async remove(id: string, actorId: string) {
    const media = await this.prisma.media.findUnique({
      where: { id },
      include: { _count: { select: { attachments: true } } }
    });

    if (!media) {
      throw new NotFoundException(`Media '${id}' was not found`);
    }

    if (media._count.attachments > 0) {
      throw new ConflictException(`This image is used in ${media._count.attachments} place(s). Remove it there first.`);
    }

    await this.prisma.media.delete({ where: { id } });

    if (media.storageKey) {
      await this.storage.remove(media.storageKey);
    }

    await this.audit.record({ actorId, action: 'DELETE', entityType: 'MEDIA', entityId: id, summary: media.altText });
    return { id, deleted: true };
  }

  private serialize(media: Media) {
    return {
      id: media.id,
      url: mediaUrl(media),
      altText: media.altText,
      credit: media.credit,
      license: media.license,
      sourceUrl: media.sourceUrl,
      width: media.width,
      height: media.height,
      bytes: media.bytes,
      mimeType: media.mimeType,
      isExternal: media.storageKey === null,
      createdAt: media.createdAt.toISOString()
    };
  }
}
