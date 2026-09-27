import { ChildProcess, spawn } from 'child_process';
import { createServer } from 'net';
import { join } from 'path';

/**
 * Starts the compiled API (`npm run build` first) against E2E_DATABASE_URL,
 * which must point at a migrated and seeded database that is safe to write to.
 */
export interface ApiServer {
  baseUrl: string;
  stop: () => Promise<void>;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address ? resolve(address.port) : reject(new Error('no port'))
      );
    });
  });
}

export async function startApi(env: Record<string, string> = {}): Promise<ApiServer> {
  const databaseUrl = process.env.E2E_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('Set E2E_DATABASE_URL to a migrated, seeded, disposable database.');
  }

  const port = await freePort();
  const child: ChildProcess = spawn(process.execPath, [join(__dirname, '../../dist/main.js')], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      API_PORT: String(port),
      AUTH_TOKEN_SECRET: 'e2e-secret-that-is-comfortably-longer-than-32-chars',
      AUTH_RATE_LIMIT_PER_MINUTE: '1000',
      API_RATE_LIMIT_PER_MINUTE: '10000',
      OTP_FIXED_CODE: '123456',
      ...env
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout?.on('data', (chunk) => (output += chunk));
  child.stderr?.on('data', (chunk) => (output += chunk));

  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`API exited during startup:\n${output}`);
    }

    try {
      if ((await fetch(`${baseUrl}/health`)).ok) {
        return {
          baseUrl,
          stop: () =>
            new Promise((resolve) => {
              child.once('exit', () => resolve());
              child.kill('SIGTERM');
            })
        };
      }
    } catch {
      // Not listening yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  child.kill('SIGKILL');
  throw new Error(`API did not become healthy in time:\n${output}`);
}

export interface ApiResult<T = any> {
  status: number;
  body: { success: boolean; data: T; error?: { code: string; message: string } };
  cookies: string[];
  headers: Headers;
}

export class ApiClient {
  token?: string;
  /** Minimal cookie jar: name -> value, enough for the refresh cookie. */
  readonly jar = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  async call<T = any>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    if (this.jar.size) {
      headers.Cookie = [...this.jar].map(([name, value]) => `${name}=${value}`).join('; ');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const cookies = response.headers.getSetCookie();

    for (const cookie of cookies) {
      const [pair, ...attributes] = cookie.split(';');
      const [name, ...value] = pair.split('=');
      const expired = attributes.some((attribute) =>
        /expires=Thu, 01 Jan 1970/i.test(attribute.trim())
      );

      if (expired || value.join('=') === '') {
        this.jar.delete(name.trim());
      } else {
        this.jar.set(name.trim(), value.join('='));
      }
    }

    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : { success: response.ok, data: undefined },
      cookies,
      headers: response.headers
    };
  }

  async upload(path: string, file: Blob, filename: string, fields: Record<string, string>) {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => form.append(key, value));
    form.append('file', file, filename);
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      body: form
    });
    return { status: response.status, body: await response.json() };
  }

  async register(name: string, email: string, password = 'password-123') {
    const result = await this.call('POST', '/auth/register', { name, email, password });
    this.token = result.body.data?.token;
    return result;
  }
}

/** Runs a compiled CLI (e.g. promote-user) against the e2e database. */
export function runCli(script: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(__dirname, `../../dist/cli/${script}.js`), ...args], {
      env: {
        ...process.env,
        DATABASE_URL: process.env.E2E_DATABASE_URL,
        AUTH_TOKEN_SECRET: 'e2e-secret-that-is-comfortably-longer-than-32-chars'
      }
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('exit', (code) => (code === 0 ? resolve(output) : reject(new Error(output))));
  });
}

/** A random, valid Indian mobile number so each test user gets fresh OTP limits. */
export function uniquePhone(): string {
  return `9${Math.floor(100_000_000 + Math.random() * 899_999_999)}`;
}

export function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.test`;
}
