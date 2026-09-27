import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse
} from '@angular/ssr/node';
import express, { NextFunction, Request, Response } from 'express';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');
const siteUrl = (process.env['SITE_URL'] ?? 'http://localhost:4000').replace(/\/$/, '');
const apiBaseUrl = (process.env['SSR_API_BASE_URL'] ?? 'http://localhost:3000/api/v1').replace(/\/$/, '');
const allowedHosts = (process.env['ALLOWED_HOSTS'] ?? 'localhost')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

const apiProxyTarget = process.env['API_PROXY_TARGET']?.replace(/\/$/, '');

const app = express();
app.disable('x-powered-by');

if (process.env['TRUST_PROXY']) {
  // Behind a load balancer: trust X-Forwarded-Proto so req.protocol is right.
  app.set('trust proxy', process.env['TRUST_PROXY'] === 'true' ? 1 : process.env['TRUST_PROXY']);
}

/**
 * Baseline security headers for every page. The CSP only restricts framing,
 * <base> and plugins: Angular's hydration needs inline scripts, so script
 * sources are left to a future nonce-based policy.
 */
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), payment=(), geolocation=(self)');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'");

  if (siteUrl.startsWith('https://')) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
});

/** Liveness for the web container; does not depend on the API. */
app.get('/healthz', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ status: 'ok' });
});

/**
 * Optional same-origin mode: forward /api and /uploads to the API so the
 * browser talks to one origin (no CORS, first-party refresh cookie). Leave
 * API_PROXY_TARGET unset when a load balancer already routes those paths.
 */
function proxyToApi(req: Request, res: Response, next: NextFunction): void {
  if (!apiProxyTarget) {
    // Never let Angular render API paths as pages.
    res.status(502).json({ success: false, error: { code: 'API_NOT_ROUTED', message: 'API is not routed to this server' } });
    return;
  }

  const target = new URL(req.originalUrl, apiProxyTarget);
  const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const upstream = send(
    target,
    {
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host,
        'x-forwarded-host': req.headers.host ?? '',
        'x-forwarded-proto': req.protocol,
        'x-forwarded-for': [req.headers['x-forwarded-for'], req.socket.remoteAddress].filter(Boolean).join(', ')
      }
    },
    (response) => {
      res.status(response.statusCode ?? 502);
      Object.entries(response.headers).forEach(([name, value]) => value !== undefined && res.setHeader(name, value));
      response.pipe(res);
    }
  );

  upstream.on('error', next);
  req.pipe(upstream);
}

app.use('/api', proxyToApi);
app.use('/uploads', proxyToApi);
// Host allow-list guards against SSRF through a spoofed Host header.
const angularApp = new AngularNodeAppEngine({ allowedHosts });

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Disallow: /admin',
      'Disallow: /profile',
      'Disallow: /trip/',
      'Disallow: /t/',
      'Disallow: /saved-trips',
      'Disallow: /itinerary',
      'Disallow: /trip-details',
      'Disallow: /vehicles',
      'Disallow: /sign-in',
      'Disallow: /sign-up',
      'Disallow: /quote',
      'Disallow: /quotes',
      'Disallow: /agent',
      `Sitemap: ${siteUrl}/sitemap.xml`,
      ''
    ].join('\n')
  );
});

let sitemapCache: { xml: string; expires: number } | null = null;

app.get('/sitemap.xml', async (_req, res, next) => {
  try {
    if (!sitemapCache || sitemapCache.expires < Date.now()) {
      const response = await fetch(`${apiBaseUrl}/seo/sitemap-entries`);

      if (!response.ok) {
        throw new Error(`Sitemap entries request failed with ${response.status}`);
      }

      const { data } = (await response.json()) as { data: Array<{ path: string; lastmod: string | null }> };
      const escape = (value: string) =>
        value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const urls = data
        .map(
          (entry) =>
            `  <url><loc>${escape(`${siteUrl}${entry.path}`)}</loc>${
              entry.lastmod ? `<lastmod>${entry.lastmod.slice(0, 10)}</lastmod>` : ''
            }</url>`
        )
        .join('\n');
      sitemapCache = {
        xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
        expires: Date.now() + 10 * 60 * 1000
      };
    }

    res.type('application/xml').setHeader('Cache-Control', 'public, max-age=600').send(sitemapCache.xml);
  } catch (error) {
    next(error);
  }
});

/** Serve static files from /browser. Hashed bundles are immutable. */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false
  })
);

/** Handle all other requests by rendering the Angular application. */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  const server = app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });

  // Finish in-flight requests before exiting on deploys.
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}

/** Request handler used by the Angular CLI (dev server and build). */
export const reqHandler = createNodeRequestHandler(app);
