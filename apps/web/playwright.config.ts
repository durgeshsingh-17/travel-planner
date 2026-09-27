import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests against the production builds: the compiled API and the SSR
 * server, same-origin through the SSR proxy. Build both apps first and point
 * E2E_DATABASE_URL at a migrated, seeded, disposable database (see README).
 */
const apiPort = Number(process.env['E2E_API_PORT'] ?? 3400);
const webPort = Number(process.env['E2E_WEB_PORT'] ?? 4400);
const databaseUrl = process.env['E2E_DATABASE_URL'];

if (!databaseUrl) {
  throw new Error('Set E2E_DATABASE_URL to a migrated, seeded, disposable database.');
}

export const e2eEnv = {
  apiUrl: `http://localhost:${apiPort}/api/v1`,
  webUrl: `http://localhost:${webPort}`,
  databaseUrl
};

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: e2eEnv.webUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Use a local Chrome instead of downloading a browser: PLAYWRIGHT_CHROME_PATH=/path/to/chrome
    launchOptions: process.env['PLAYWRIGHT_CHROME_PATH'] ? { executablePath: process.env['PLAYWRIGHT_CHROME_PATH'] } : {}
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node ../api/dist/main.js',
      url: `${e2eEnv.apiUrl}/health/ready`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: databaseUrl,
        API_PORT: String(apiPort),
        API_CORS_ORIGIN: e2eEnv.webUrl,
        AUTH_TOKEN_SECRET: 'playwright-secret-that-is-comfortably-longer-than-32-chars',
        AUTH_RATE_LIMIT_PER_MINUTE: '1000',
        API_RATE_LIMIT_PER_MINUTE: '10000',
        WRITE_RATE_LIMIT_PER_MINUTE: '1000',
        MEDIA_PUBLIC_BASE_URL: '/uploads',
        OTP_FIXED_CODE: '123456',
        ROUTING_PROVIDER: 'estimate'
      }
    },
    {
      command: 'node dist/web/server/server.mjs',
      url: `${e2eEnv.webUrl}/healthz`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(webPort),
        SITE_URL: e2eEnv.webUrl,
        SSR_API_BASE_URL: e2eEnv.apiUrl,
        API_PROXY_TARGET: `http://localhost:${apiPort}`,
        ALLOWED_HOSTS: 'localhost'
      }
    }
  ]
});
