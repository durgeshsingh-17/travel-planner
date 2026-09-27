/**
 * Per-user budget for routes that create content or call the road router
 * (trips, generation, quote requests, reviews). Lower than the global limit.
 */
export const WRITE_THROTTLE = {
  default: {
    limit: Number.parseInt(process.env.WRITE_RATE_LIMIT_PER_MINUTE ?? '20', 10),
    ttl: 60_000
  }
};
