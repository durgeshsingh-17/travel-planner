/** Tighter limit for credential and token endpoints; configurable for tests and load tests. */
export const AUTH_THROTTLE = {
  default: {
    limit: Number.parseInt(process.env.AUTH_RATE_LIMIT_PER_MINUTE ?? '10', 10),
    ttl: 60_000
  }
};
