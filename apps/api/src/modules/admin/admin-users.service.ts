import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuditService } from '../content/audit.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async list(q?: string) {
    const users = await this.prisma.user.findMany({
      where: q
        ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] }
        : undefined,
      select: { id: true, name: true, email: true, role: true, createdAt: true, _count: { select: { trips: true } } },
      orderBy: [{ role: 'desc' }, { createdAt: 'desc' }],
      take: 100
    });

    return users.map(({ _count, ...user }) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      tripCount: _count.trips
    }));
  }

  async setRole(actorId: string, userId: string, role: UserRole) {
    if (actorId === userId && role !== 'ADMIN') {
      // Prevent the last line of defence: an admin locking themselves out.
      throw new BadRequestException('You cannot remove your own admin role.');
    }

    const before = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, email: true } });
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true }
    });
    await this.audit.record({
      actorId,
      action: 'ROLE_CHANGE',
      entityType: 'USER',
      entityId: userId,
      summary: `${before.email}: ${before.role} → ${role}`
    });

    return user;
  }
}
