import { Logger } from '@nestjs/common';

type Env = Record<string, unknown>;

const text = (env: Env, key: string) => (typeof env[key] === 'string' ? (env[key] as string).trim() : '');

/**
 * Checks the environment at startup. In production a missing or unsafe
 * setting stops the API before it serves traffic, with every problem listed.
 */
export function validateEnvironment(env: Env): Env {
  const problems: string[] = [];
  const warnings: string[] = [];
  const production = text(env, 'NODE_ENV') === 'production';

  if (!text(env, 'DATABASE_URL')) problems.push('DATABASE_URL is required');

  const routing = text(env, 'ROUTING_PROVIDER') || 'estimate';
  if (!['osrm', 'estimate'].includes(routing)) problems.push(`ROUTING_PROVIDER must be "osrm" or "estimate", not "${routing}"`);

  for (const key of ['API_PORT', 'ROUTING_TIMEOUT_MS', 'ROUTING_CACHE_DAYS', 'API_RATE_LIMIT_PER_MINUTE', 'AUTH_RATE_LIMIT_PER_MINUTE', 'WRITE_RATE_LIMIT_PER_MINUTE']) {
    if (text(env, key) && !/^\d+$/.test(text(env, key))) problems.push(`${key} must be a whole number`);
  }

  if (production) {
    if (text(env, 'AUTH_TOKEN_SECRET').length < 32) problems.push('AUTH_TOKEN_SECRET must be at least 32 characters');
    if (text(env, 'OTP_FIXED_CODE')) problems.push('OTP_FIXED_CODE must not be set in production');
    if ((text(env, 'SMS_PROVIDER') || 'log') === 'log') problems.push('SMS_PROVIDER must be a real provider (e.g. "twilio") in production');
    if (!text(env, 'API_CORS_ORIGIN') || /localhost|127\.0\.0\.1/.test(text(env, 'API_CORS_ORIGIN'))) {
      problems.push('API_CORS_ORIGIN must be the public site origin');
    }
    if (!text(env, 'MEDIA_PUBLIC_BASE_URL')) problems.push('MEDIA_PUBLIC_BASE_URL is required (for example https://example.in/uploads)');
    if (routing === 'osrm' && (!text(env, 'OSRM_BASE_URL') || text(env, 'OSRM_BASE_URL').includes('router.project-osrm.org'))) {
      warnings.push('OSRM_BASE_URL points at the public OSRM demo server, which is not meant for production traffic');
    }
  }

  warnings.forEach((warning) => new Logger('Environment').warn(warning));

  if (problems.length) {
    throw new Error(`Invalid environment:\n  - ${problems.join('\n  - ')}`);
  }

  return env;
}
