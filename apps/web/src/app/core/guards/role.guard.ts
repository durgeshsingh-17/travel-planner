import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { SessionService } from '../auth/session.service';

/** Editorial areas. The API enforces roles too; this only avoids showing a broken page. */
export const editorGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);

  if (!session.session().isAuthenticated) {
    return router.createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
  }

  return session.isEditor() ? true : router.createUrlTree(['/']);
};

/** Agency inbox. */
export const agentGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);

  if (!session.session().isAuthenticated) {
    return router.createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
  }

  return session.isAgent() ? true : router.createUrlTree(['/']);
};

/** Admin-only screens inside the editorial area. */
export const adminGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  return session.session().user?.role === 'ADMIN' ? true : inject(Router).createUrlTree(['/admin']);
};
