import { HttpErrorResponse, HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { API_BASE_URL } from '../config/api.config';
import { SessionService } from '../auth/session.service';

/** Endpoints where a 401 means "wrong credentials", not "session expired". */
const CREDENTIAL_ENDPOINTS = ['/auth/login', '/auth/register'];

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);
  const token = sessionService.session().token;
  const isApiRequest = request.url.startsWith(API_BASE_URL);
  // Never send the auth token to third-party hosts.
  const authorizedRequest =
    token && isApiRequest
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

  return next(authorizedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      const isCredentialCheck = CREDENTIAL_ENDPOINTS.some((path) => request.url.endsWith(path));

      if (
        error.status === HttpStatusCode.Unauthorized &&
        isApiRequest &&
        token &&
        !isCredentialCheck
      ) {
        sessionService.clear();
        void router.navigate(['/sign-in'], {
          queryParams: { returnUrl: router.url, reason: 'session-expired' }
        });
      }

      const message =
        error.error?.error?.message ?? 'We could not complete that request.';
      return throwError(() => new Error(message));
    })
  );
};
