import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpStatusCode
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, switchMap, throwError } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import { SessionService } from '../auth/session.service';

/** Endpoints where a 401 is an answer, not an expired access token. */
const NO_REFRESH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

function withToken(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
}

function toError(error: HttpErrorResponse): Error {
  const message = error.error?.error?.message ?? 'We could not complete that request.';
  return Object.assign(new Error(message), {
    status: error.status,
    code: error.error?.error?.code as string | undefined
  });
}

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  if (!request.url.startsWith(API_BASE_URL)) {
    // Never send credentials to third-party hosts.
    return next(request).pipe(catchError((error: HttpErrorResponse) => throwError(() => toError(error))));
  }

  // Credentials let the browser send and store the refresh cookie (path-scoped to /auth).
  const apiRequest = request.clone({ withCredentials: true });
  const token = sessionService.session().token;
  const canRefresh =
    Boolean(token) && !NO_REFRESH_ENDPOINTS.some((path) => request.url.endsWith(path));

  const expireSession = (): Observable<never> => {
    sessionService.clear();
    void router.navigate(['/sign-in'], {
      queryParams: { returnUrl: router.url, reason: 'session-expired' }
    });
    return throwError(() => new Error('Your session has expired. Please sign in again.'));
  };

  return next(withToken(apiRequest, token)).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== HttpStatusCode.Unauthorized || !canRefresh) {
        return throwError(() => toError(error));
      }

      return sessionService.refresh().pipe(
        catchError(() => expireSession()),
        switchMap((freshToken) =>
          next(withToken(apiRequest, freshToken)).pipe(
            catchError((retryError: HttpErrorResponse) =>
              retryError.status === HttpStatusCode.Unauthorized
                ? expireSession()
                : throwError(() => toError(retryError))
            )
          )
        )
      );
    })
  );
};
