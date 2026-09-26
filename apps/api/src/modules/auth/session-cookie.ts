import { Request, Response } from 'express';

import { ClientContext, IssuedSession } from './auth.service';

export const REFRESH_COOKIE_NAME = 'tp_refresh';
// Scoped to the auth routes so the refresh token is never sent with other API calls.
const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function setRefreshCookie(response: Response, session: IssuedSession): void {
  response.cookie(REFRESH_COOKIE_NAME, session.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    expires: session.refreshTokenExpiresAt
  });
}

export function clearRefreshCookie(response: Response): void {
  response.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH
  });
}

export function readRefreshCookie(request: Request): string | undefined {
  const header = request.headers.cookie;

  if (!header) {
    return undefined;
  }

  for (const part of header.split(';')) {
    const [name, ...value] = part.trim().split('=');

    if (name === REFRESH_COOKIE_NAME) {
      return decodeURIComponent(value.join('='));
    }
  }

  return undefined;
}

export function clientContext(request: Request): ClientContext {
  return {
    userAgent: request.headers['user-agent'],
    ip: request.ip
  };
}

/** Public shape of a session: the refresh token stays in the httpOnly cookie. */
export function sessionResponse(session: IssuedSession) {
  return {
    token: session.token,
    expiresAt: session.expiresAt,
    user: session.user
  };
}
