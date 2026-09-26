import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:isPublic';

/**
 * Every route requires sign-in unless it is marked public. The route-access
 * test fails if a public route is not listed in its allow-list.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
