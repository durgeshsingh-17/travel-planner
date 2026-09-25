import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { SessionService } from '../auth/session.service';

export const apiErrorInterceptor: HttpInterceptorFn = (_request, next) => {
  const session = inject(SessionService).session();
  const request = session.token
    ? _request.clone({
        setHeaders: {
          Authorization: `Bearer ${session.token}`
        }
      })
    : _request;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      const message =
        error.error?.error?.message ?? 'We could not complete that request.';
      return throwError(() => new Error(message));
    })
  );
};
