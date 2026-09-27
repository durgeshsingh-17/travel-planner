import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  action:
    | 'CREATE'
    | 'UPDATE'
    | 'PUBLISH'
    | 'UNPUBLISH'
    | 'ARCHIVE'
    | 'DELETE'
    | 'IMPORT'
    | 'ROLE_CHANGE'
    | 'ROUTE'
    | 'MODERATE';
  entityType:
    | 'DESTINATION'
    | 'PLACE'
    | 'COLLECTION'
    | 'PACKAGE'
    | 'TAG'
    | 'MEDIA'
    | 'IMPORT'
    | 'USER'
    | 'AGENT'
    | 'QUOTE_REQUEST'
    | 'REVIEW';
  entityId: string;
  summary?: string;
  changes?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pass the transaction client when the audited change runs inside one. */
  async record(entry: AuditEntry, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        summary: entry.summary,
        changes: entry.changes
      }
    });
  }

  async list(query: { entityType?: string; entityId?: string; page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 100);
    const where = { entityType: query.entityType, entityId: query.entityId };
    const [total, entries] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);
    const actorIds = [...new Set(entries.map((entry) => entry.actorId).filter((id): id is string => Boolean(id)))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
      : [];

    return {
      items: entries.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
        actor: actors.find((actor) => actor.id === entry.actorId) ?? null
      })),
      page,
      pageSize,
      total
    };
  }
}
