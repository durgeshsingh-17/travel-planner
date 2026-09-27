# Launch checklist

Work through this before sending real traffic. Each item says how to check it.

## Configuration

- [ ] `NODE_ENV=production` on the API and web containers. The API refuses to start and lists every problem if a production setting is unsafe or missing.
- [ ] `AUTH_TOKEN_SECRET` is at least 32 random characters (`openssl rand -base64 48`), stored in the secret manager, not in the image or the repo.
- [ ] `OTP_FIXED_CODE` is **not** set.
- [ ] `SMS_PROVIDER=twilio` with real `TWILIO_*` credentials. Send yourself a code from `/quote` to check.
- [ ] `API_CORS_ORIGIN` and `SITE_URL` are the public `https://` origin. `ALLOWED_HOSTS` lists every public host name.
- [ ] `MEDIA_PUBLIC_BASE_URL` points at `/uploads` (same-origin proxy) or the CDN, and `MEDIA_STORAGE_DIR` is a persistent volume that is backed up.
- [ ] `TRUST_PROXY=true` (or the hop count) on both API and web when behind a load balancer. Without it, rate limits treat every visitor as one client.
- [ ] `ROUTING_PROVIDER=osrm` with `OSRM_BASE_URL` pointing at **your own** OSRM server built from an India extract. The public demo server is not meant for production traffic, and the API logs a warning if you use it.
- [ ] Fuel prices (`FUEL_PRICE_PETROL_INR`, `FUEL_PRICE_DIESEL_INR`) are current.

## Database

- [ ] Managed Postgres with automated daily backups and point-in-time recovery. Do one test restore.
- [ ] Migrations run as a separate one-off job before the new API starts (`--target migrate` image, or `npx prisma migrate deploy`). Never run `migrate dev` against production.
- [ ] The app's database user can read and write but cannot create databases.

## Content

- [ ] Starter content imported (`node dist/cli/import-content.js <file> --apply`), then reviewed in the admin area.
- [ ] Every published destination passes its health checks (cover image with licence and credit, intro, at least a few places with opening hours).
- [ ] First admin promoted with `node dist/cli/promote-user.js <email> ADMIN`. Nobody else has admin.
- [ ] Agencies are verified, have service states and a linked user, and can sign in to `/agent`.

## Health, restarts and housekeeping

- [ ] The load balancer uses `GET /api/v1/health/ready` for readiness and `/api/v1/health/live` for liveness. The web server answers `GET /healthz`.
- [ ] A rolling deploy drains cleanly: both servers stop on `SIGTERM` after finishing in-flight requests.
- [ ] Housekeeping runs (`MAINTENANCE_INTERVAL_MINUTES`, default 60). The API log shows `Housekeeping done` every hour. Running it on several instances is safe.

## Security

- [ ] HTTPS only, with HTTP redirected at the load balancer. The web server sends HSTS when `SITE_URL` is `https://`.
- [ ] Response headers checked on `/`: `x-content-type-options`, `x-frame-options`, `content-security-policy` (frame-ancestors), `referrer-policy`; there is no `x-powered-by`.
- [ ] Rate limits are right for launch traffic: `API_RATE_LIMIT_PER_MINUTE`, `AUTH_RATE_LIMIT_PER_MINUTE`, `WRITE_RATE_LIMIT_PER_MINUTE`.
- [ ] Swagger (`/api/docs`) is blocked at the load balancer if you don't want it public.
- [ ] `npm audit --omit=dev` is reviewed and there are no high or critical issues left open.

## SEO

- [ ] `/robots.txt` and `/sitemap.xml` load on the public host and the sitemap lists destinations, places, collections and packages.
- [ ] Unknown URLs return **404**. Try `curl -I https://<host>/nope`.
- [ ] Sitemap submitted in Google Search Console, and a few destination pages inspected there.
- [ ] The canonical URL on a destination page is the public `https://` URL.

## Monitoring

- [ ] API and web logs are collected centrally. API errors carry a `requestId` (also in the `x-request-id` header), so a user's error report can be found in the API log.
- [ ] Alerts are set for readiness failures, a 5xx rate above 1%, p95 latency above 1.5 s, and database CPU or storage.
- [ ] You can see road-router fallbacks: a spike in `Road router unavailable` warnings means OSRM is down, and plans are falling back to estimates.

## Final pass

- [ ] CI is green on the release commit: API unit and e2e tests, web unit tests, and the Playwright browser suite.
- [ ] Smoke test on production: sign up, plan a trip, generate, drag a stop to another day, re-plan a day, share the link and open it signed out, request quotes for a package, and approve a review in admin.
- [ ] Rollback plan written down: the previous image tags, and whether the release's migrations can be rolled back or only rolled forward.
