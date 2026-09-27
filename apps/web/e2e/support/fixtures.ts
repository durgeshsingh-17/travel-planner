import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { Page, expect, test as base } from '@playwright/test';

import { e2eEnv } from '../../playwright.config';

export const PASSWORD = 'password-123';

export interface Account {
  email: string;
  token: string;
}

/** Thin API client for arranging data; the UI is what the tests exercise. */
export async function api<T = any>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const response = await fetch(`${e2eEnv.apiUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const json = await response.json();

  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status} ${JSON.stringify(json)}`);
  }

  return json.data as T;
}

export function unique(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function registerAccount(name: string, role?: 'ADMIN' | 'EDITOR'): Promise<Account> {
  const email = `${unique(name.toLowerCase().replace(/\s+/g, '-'))}@e2e.test`;
  const result = await api<{ token: string }>('POST', '/auth/register', { name, email, password: PASSWORD });

  if (role) {
    execFileSync(process.execPath, [join(__dirname, '../../../api/dist/cli/promote-user.js'), email, role], {
      env: { ...process.env, DATABASE_URL: e2eEnv.databaseUrl },
      stdio: 'pipe'
    });
    // Roles are read per request, but sign in again for a clean session.
    return { email, token: (await api<{ token: string }>('POST', '/auth/login', { email, password: PASSWORD })).token };
  }

  return { email, token: result.token };
}

export async function signIn(page: Page, email: string, returnUrl = '/'): Promise<void> {
  await page.goto(`/sign-in?returnUrl=${encodeURIComponent(returnUrl)}`);
  await page.locator('input[formcontrolname="email"]').fill(email);
  await page.locator('input[formcontrolname="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'));
}

function watch(page: Page, errors: string[]): Page {
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    // Expected API refusals (auth checks, not-found pages, duplicates) are logged by the browser.
    if (message.type() === 'error' && !/status of (401|404|409)/.test(message.text())) {
      errors.push(`console: ${message.text().split('\n')[0]}`);
    }
  });
  // The app confirms destructive or binding actions (accepting a quote) with confirm().
  page.on('dialog', (dialog) => void dialog.accept());
  return page;
}

/**
 * `page` and every page from `openPage()` (a fresh, signed-out browser
 * context) accept confirm dialogs and fail the test on browser errors.
 */
export const test = base.extend<{ errors: string[]; openPage: () => Promise<Page> }>({
  errors: [
    async ({}, use) => {
      const errors: string[] = [];
      await use(errors);
      expect(errors, 'browser errors').toEqual([]);
    },
    { auto: true }
  ],
  page: async ({ page, errors }, use) => {
    await use(watch(page, errors));
  },
  openPage: async ({ browser, errors }, use) => {
    await use(async () => watch(await (await browser.newContext()).newPage(), errors));
  }
});

export { expect };
