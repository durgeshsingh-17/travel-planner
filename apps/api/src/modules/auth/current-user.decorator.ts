import {
  ExecutionContext,
  UnauthorizedException,
  createParamDecorator
} from '@nestjs/common';

import { AuthenticatedRequest } from './auth.guard';

/** Resolves the signed-in user's id. Use together with `AuthGuard`. */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException('Sign in to continue.');
    }

    return request.user.id;
  }
);
