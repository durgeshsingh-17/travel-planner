export const configuration = () => ({
  api: {
    port: parseInt(process.env.API_PORT ?? '3000', 10),
    corsOrigin: process.env.API_CORS_ORIGIN ?? 'http://localhost:4200'
  },
  auth: {
    tokenSecret: process.env.AUTH_TOKEN_SECRET,
    accessTokenTtlSeconds: parseInt(process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS ?? '900', 10),
    refreshTokenTtlDays: parseInt(process.env.AUTH_REFRESH_TOKEN_TTL_DAYS ?? '30', 10)
  },
  media: {
    storageDir: process.env.MEDIA_STORAGE_DIR ?? 'uploads',
    publicBaseUrl:
      process.env.MEDIA_PUBLIC_BASE_URL ??
      `http://localhost:${process.env.API_PORT ?? '3000'}/uploads`
  },
  routing: {
    /** 'osrm' calls an OSRM server; 'estimate' uses straight-line distance (offline, tests). */
    provider: process.env.ROUTING_PROVIDER ?? 'estimate',
    osrmBaseUrl: process.env.OSRM_BASE_URL ?? 'https://router.project-osrm.org',
    timeoutMs: parseInt(process.env.ROUTING_TIMEOUT_MS ?? '4000', 10),
    cacheDays: parseInt(process.env.ROUTING_CACHE_DAYS ?? '30', 10)
  },
  sms: {
    provider: process.env.SMS_PROVIDER ?? 'log',
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFrom: process.env.TWILIO_FROM
  },
  database: {
    url: process.env.DATABASE_URL
  },
  pricing: {
    petrolFuelPriceInr: parseFloat(process.env.FUEL_PRICE_PETROL_INR ?? '105'),
    dieselFuelPriceInr: parseFloat(process.env.FUEL_PRICE_DIESEL_INR ?? '94')
  }
});
