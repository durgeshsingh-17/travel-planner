import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { SessionService } from '../auth/session.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService).session();

  if (session.isAuthenticated) {
    return true;
  }

  return inject(Router).createUrlTree(['/sign-in'], {
    queryParams: { returnUrl: state.url }
  });
};
