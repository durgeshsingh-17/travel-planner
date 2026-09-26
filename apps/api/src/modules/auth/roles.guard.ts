import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { AuthenticatedRequest } from './auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { ROLES_KEY } from './roles.decorator';

/**
 * Runs after `AuthGuard`. Roles are read from the database on each request so
 * a demotion takes effect immediately instead of when the token expires.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException('Sign in to continue.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { role: true }
    });

    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('You do not have access to this area.');
    }

    return true;
  }
}
