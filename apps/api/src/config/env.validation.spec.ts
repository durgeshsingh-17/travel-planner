import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './env.validation';

const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://app@db/travel',
  AUTH_TOKEN_SECRET: 'x'.repeat(40),
  SMS_PROVIDER: 'twilio',
  API_CORS_ORIGIN: 'https://yatra.example',
  MEDIA_PUBLIC_BASE_URL: 'https://yatra.example/uploads',
  ROUTING_PROVIDER: 'osrm',
  OSRM_BASE_URL: 'http://osrm.internal:5000'
};

describe('validateEnvironment', () => {
  it('accepts a complete production environment', () => {
    expect(validateEnvironment(production)).toBe(production);
  });

  it('lists every unsafe production setting at once', () => {
    expect(() =>
      validateEnvironment({ ...production, AUTH_TOKEN_SECRET: 'short', OTP_FIXED_CODE: '123456', SMS_PROVIDER: 'log', API_CORS_ORIGIN: 'http://localhost:4200' })
    ).toThrow(/AUTH_TOKEN_SECRET[\s\S]*OTP_FIXED_CODE[\s\S]*SMS_PROVIDER[\s\S]*API_CORS_ORIGIN/);
  });

  it('keeps development forgiving but still catches typos', () => {
    expect(() => validateEnvironment({ DATABASE_URL: 'postgresql://localhost/dev' })).not.toThrow();
    expect(() => validateEnvironment({ DATABASE_URL: 'postgresql://localhost/dev', ROUTING_PROVIDER: 'google' })).toThrow(/ROUTING_PROVIDER/);
    expect(() => validateEnvironment({ DATABASE_URL: 'postgresql://localhost/dev', API_PORT: '30a0' })).toThrow(/API_PORT/);
  });
});
