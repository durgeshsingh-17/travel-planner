# Travel Platform — Project Status Report

_Audit date: 2026-09-26 · Branch: `main` @ `ccf1ae1` · Companion doc: [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md)_

This report covers what exists in the repository today, what state it is in, what is broken or risky, and what remains before the product can be called a production-ready, Holidify-class travel platform.

---

## 1. Executive summary

| Area | Status |
| --- | --- |
| Builds | `npm run build:api` ✅ · `npm run build:web` ✅ |
| Tests | API: 4 files / 5 tests ✅ · Web: 2 files / 4 tests ✅ (≈ unit-level only, no integration/E2E) |
| Core flow (plan → sign in → generate → view → share) | Works end-to-end on seeded data |
| Content catalog | **Thin**: 2 destinations (Jibhi, Rishikesh), 11 places, ~18 locations, 4 vehicle models |
| Security | **Not production-safe.** 4 P0 authorization/auth issues (Section 5.1) |
| SEO | **None.** Client-only Angular SPA, no SSR/prerender, no meta tags, no sitemap |
| Monetizable surface (packages, quotes, agents) | Not started |

**Bottom line:** the road-trip planner foundation is solid and well structured (modular NestJS, pluggable itinerary generator, signals-based Angular). Before adding Holidify-style catalog features, the trips API must be locked down (a day of work), and the data model needs to become content-first (Destination → Place → Package, with media, reviews, and SEO fields).

---

## 2. Stack and repository layout

```text
travel-platform/
  apps/api/   NestJS 11 modular monolith · Prisma 6 · PostgreSQL 16 (PostGIS image, PostGIS not yet used)
  apps/web/   Angular 22 standalone components · Signals · Angular Material · SCSS · Vitest
  docs/       architecture.md, this report, roadmap
  docker-compose.yml   postgres (postgis/postgis:16-3.4); redis commented out
```

- API prefix `/api/v1`, Swagger at `/api/docs`, global `ValidationPipe` (whitelist + forbidNonWhitelisted), response envelope `{ success, data }` / `{ success:false, error:{code,message} }`, Helmet, CORS.
- Four migrations: `init`, `trip_preferences`, `locations`, `trip_travellers`.
- Seed: `apps/api/prisma/seed.ts` (idempotent via upsert + `skipDuplicates`).

---

## 3. What has been built

### 3.1 Backend modules (`apps/api/src/modules`)

| Module | Endpoints | Notes |
| --- | --- | --- |
| health | `GET /health` | Pings DB with `SELECT 1` |
| auth | `GET /auth/status`, `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | Email + password, scrypt hashing, custom HMAC token |
| users | `GET/PATCH /me`, `PATCH /me/profile`, `POST /me/password`, `DELETE /me` | Profile, travel preferences, password change, account deletion _(Week 1)_ |
| locations | `GET /locations?q&state&limit` | Autocomplete source for From/To; handles missing-table error with 503 |
| destinations | `GET /destinations?q&state&limit`, `GET /destinations/:slug` | Detail includes places |
| places | `GET /places?destinationSlug&category` | No detail endpoint, no pagination |
| vehicles | `GET /vehicles?type&fuelType`, `GET/POST /vehicles/my`, `PATCH/PUT/DELETE /vehicles/my/:id` | Indian RTO + BH-series registration validation and normalization |
| trips | `POST /trips/preview`, `POST /trips`, `GET /trips`, `GET/PATCH/DELETE /trips/:id`, `POST /trips/:id/generate-itinerary` | Create + generate require auth |
| itinerary | (internal) | `ITINERARY_GENERATOR` token → `DatabaseItineraryGenerator`; `TripCostService`, `TripDistanceService` |
| maps | `GET /maps/route` | Returns bbox + OpenStreetMap embed URL (no real routing) |
| weather | `GET /weather/forecast` | Open-Meteo 7-day; falls back to synthetic data on failure |

**Itinerary generator** (`database-itinerary.generator.ts`): finds a `Destination` by name or ±0.02° box, ranks its places by rating + keyword match on interests/preferences, and builds arrival / local / return days with fixed time slots. Distance = haversine × 1.35; duration = distance ÷ 45 km/h.

**Cost engine** (`trip-cost.service.ts`): fuel (from vehicle mileage + env fuel price), tolls (₹0.8/km), stay (₹1,800/person/night), food (₹900/person/day), activities (₹450/person/day), parking (₹120/day), misc 8%.

### 3.2 Frontend routes (`apps/web/src/app/app.routes.ts`)

| Route | Component | State |
| --- | --- | --- |
| `/` | Home | Quick planner form with autocomplete, destination carousels |
| `/plan` | TripPlanner (556 LOC) | Full planner: locations, dates, traveller details, travel mode, saved vehicle, interests, budget; redirects to sign-in before generating |
| `/trip/:id` | TripResult | Day-wise plan, cost breakdown, OSM map, weather, Web Share / clipboard |
| `/explore` | Explore | Carousels + catalog grid from `/destinations` |
| `/destinations/:slug` | DestinationDetail | Hero, description, map, place cards |
| `/itinerary`, `/trip-details/:id` | Itinerary list / details | Lists all trips from `GET /trips` |
| `/saved-trips` | SavedTrips | Filters `GET /trips` by IDs stored in `localStorage` |
| `/vehicles` | Vehicles | CRUD for user vehicles |
| `/profile` | Profile | Read-only view of session user |
| `/sign-in`, `/sign-up` | AuthPage | Login/register |

Shared: loading and empty-state components, toast service (MatSnackBar), network online/offline toasts, INR pipe, route-map iframe, section carousel, trip card, light/dark theme (`body.dark-theme`).

---

## 4. Current data model

`User`, `Vehicle` (catalog), `UserVehicle`, `Location`, `Destination`, `Place`, `Trip`, `TripTraveller`, `TripDay`, `TripActivity`, plus enums `VehicleType`, `FuelType`, `PlaceCategory`, `TravelMode`, `TripStatus`, `TripActivityType`, `TravellerGender`.

Structural gaps (details and proposed schema in the roadmap, §4):
- `Location` and `Destination` are separate, unlinked tables that duplicate name/state/coords.
- `Place` has no rich content: no images, tags, entry-fee breakdown, weekly timings, rank, SEO fields, or publish status.
- `Trip.vehicleId` references the **catalog** `Vehicle`, not the user's `UserVehicle`, so `customMileage` is never used.
- No `Package`, `Agent`, `Review`, `QuoteRequest`, `Media`, `SavedItem`, `UserProfile`, `Collection`, or role/admin concept.
- No `publishedAt`/`status` on content, no soft delete, no audit trail.

---

## 5. Issues found during the audit

### 5.1 P0 — fix before anything else

> **Update 2026-09-29 (Weeks 2–3 complete):** content platform, admin panel, importer and SSR. See the checklist in §6. Note: PR #6 described removing the hardcoded Gurgaon map origin and the made-up place values on the destination page, but those two changes did not reach `main`. The rewritten destination page on `feature/content-platform` fixes both.

> **Update 2026-09-28 (Week 1 complete):** 15-minute access tokens with rotating httpOnly refresh cookies (reuse detection revokes the session family), auth rate limiting, a global secure-by-default guard with an app-wide route-access test, `RolesGuard`, real profile endpoints and page, request IDs, and GitHub Actions CI.

> **Update 2026-09-27:** all four P0 issues below, plus P1 #3, #4, #5, #7, #10 and #13 and the P2 note on manual header parsing, are fixed on branch `fix/trip-security-and-data-integrity`. They are covered by unit tests and an end-to-end API check run against a real database.

| # | Issue | Where | Impact |
| --- | --- | --- | --- |
| 1 | `GET /trips` with no `Authorization` header returns **every user's trips**, including traveller full names, ages, and genders. `/itinerary` and `/saved-trips` call it while signed out. | `trips.service.ts` `findAll` (`where: undefined` when no user) | Personal data leak |
| 2 | `PATCH /trips/:id` and `DELETE /trips/:id` skip the ownership check when no token is sent (`optionalUserId` → `undefined` → check bypassed). | `trips.controller.ts` + `assertTripExists` | Anyone can edit or delete any trip by UUID |
| 3 | `AUTH_TOKEN_SECRET` is not in either `.env.example`; the code falls back to `'dev-auth-secret'`. Tokens have **no expiry** and cannot be revoked. | `auth.service.ts` `signPayload`, `signToken` | Token forgery if deployed with the default; stolen tokens are valid forever |
| 4 | Share links: `GET /trips/:id` is public to signed-out visitors but returns **404 to a signed-in non-owner**. It also exposes full traveller PII to anyone who has the link. | `trips.service.ts` `findById` | Sharing is broken for logged-in recipients, and sharing leaks PII |

**Fix pattern:** add a `JwtAuthGuard` + `@CurrentUser()` decorator. Make `GET /trips` owner-only. Require ownership on PATCH/DELETE. Add `Trip.visibility (PRIVATE | UNLISTED | PUBLIC)` + `shareSlug`, and a separate `GET /public/trips/:shareSlug` that omits travellers. Switch to signed JWTs (`@nestjs/jwt`) with 15-minute access tokens + rotating refresh tokens, and make the app fail on boot if the secret is missing.

### 5.2 P1 — correctness and product trust

1. `users/me` is a stub; profile editing is impossible.
2. `HttpExceptionFilter` maps 401/403/409/429 to a generic `REQUEST_FAILED`. The frontend cannot tell "session expired" apart from other errors, and unknown 500s are not logged.
3. The frontend `authGuard` exists but **is not applied to any route** (`/vehicles`, `/saved-trips`, `/itinerary`, `/profile`).
4. The API interceptor never clears the session on 401. The UI stays "signed in" with a dead token.
5. Trip cost ignores `UserVehicle.customMileage` (see §4).
6. The same speed (45 km/h) and road-distance multiplier apply to BIKE/CAR/BUS/FLIGHT. FLIGHT and BUS trips still get fuel and toll costs.
7. Middle days reuse the first places when a destination runs out of places (`pickPlacesForDay` fallback), so the same stop appears on several days.
8. Place-to-place distances are hardcoded (8 km / 4 km, 25 / 15 min).
9. If the destination has no `Destination` row (most autocomplete locations), the itinerary is generic with no places, and the UI does not say so.
10. `DestinationDetail` hardcodes the map source to Gurgaon (28.4595, 77.0266). Place cards show fallback values (`60 min`, `₹0`, `4.2/5`) as if they were real data.
11. The weather fallback shows made-up temperatures with no "estimated" label in the UI.
12. Updating trip dates, travellers, or destination does not reset the generated days or cost. Stale itineraries survive edits. `vehicleId` cannot be cleared.
13. Saved trips live only in `localStorage` (bookmarks of trip IDs), not per user, so they don't sync across devices.
14. The seed has `Gurgaon` and `Gurugram` as two locations with identical coordinates.
15. There is no rate limiting on `/auth/login` or `/auth/register`.

### 5.3 P2 — quality and maintainability

- 14 component files use hardcoded hex colours (e.g. `destination-detail.component.ts` sets `color: #17211b`). These fight the dark theme; move them to CSS custom properties.
- Large inline templates (`vehicles.component.ts` 457 LOC, `trip-details.component.ts` 377 LOC) should move to separate template and style files.
- `provideClientHydration()` is registered but there is no SSR, so it has no effect.
- A single hotlinked Unsplash image is used as the fallback for every destination.
- The web `test` script lists two spec files explicitly, so new specs won't run until someone adds them.
- `/itinerary`, `/trip-details`, and `/saved-trips` overlap in purpose (three trip-list pages).
- `Place.openingTime`/`closingTime` are free strings, so weekly schedules and closed days can't be expressed.
- Controllers read `@Headers('authorization')` manually in every handler instead of using a guard.
- No CI pipeline, no lint config wired for the API (`eslint` script exists, but eslint is not installed), no Dockerfile for the apps.

---

## 6. What is needed to complete the product

Checklist grouped by the phases in the roadmap. ✅ = done today, ⬜ = to do.

### Foundation (week 1)
- ✅ Monorepo, modular API, Prisma migrations, seed, Swagger, envelope, validation
- ✅ Email/password auth, trip planner, traveller details, vehicles, generation, result, share, toasts, loaders, dark mode
- ✅ Fix P0 #1–4 (guards, visibility, JWT + refresh, required secret)
- ✅ Real `/me` + profile update + change password + account deletion
- ✅ Error codes (`UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `RATE_LIMITED`) + JSON request logs + request IDs
- ✅ Apply `authGuard` on private routes; silent refresh, then sign-out on 401
- ✅ Server-side `SavedItem` for trips (destinations, places and packages to follow)
- ✅ CI: build, unit, migration drift check, Postgres-backed e2e on every PR

### Content platform (weeks 2–3)
- ✅ Schema: `Media`, `MediaAttachment`, `Tag`, `Collection`, rich `Destination`/`Place` fields, `PlaceTiming`, `DestinationMonthInfo`, `HowToReach`, `Faq`, `SlugRedirect`, `AuditLog`, publish status, location aliases, trigram search indexes
- ✅ Place detail page + endpoint; destination page sections (quick facts, best time, how to reach, gallery, map, FAQs, similar destinations)
- ✅ Collections pages; faceted explore (state, theme, month, trip length, budget); grouped search suggest; home rails from real data
- ✅ Admin CMS v1: editors for destinations, places, collections and tags; publish rules with a health score; concurrent-edit detection; media library with uploads; audit log; user roles
- ✅ Import pipeline: JSON bundles and CSV, dry run that rolls back, all-or-nothing apply, CLI and admin screen
- ⬜ Content volume: the starter bundle has 6 destinations and 20 places (4 destinations as drafts for review). The ≥ 50 / ≥ 500 target is editorial work, not engineering.
- ✅ SSR (public pages), per-page meta, canonical, Open Graph, JSON-LD, real 404 and 301 status, `/sitemap.xml`, `robots.txt`
- ⬜ Image resizing and responsive variants (uploads are stored as-is; a sharp or CDN step is the next media task)
- 🟡 Location ↔ Destination link: a generated trip now links the destination guide it used (`Trip.destinationId`, matched by name or within 20 km); planner locations themselves are still not linked to guides

### Marketplace (weeks 4–5)

> **Update 2026-10-01:** packages, the quote flow and reviews are built on `feature/packages-quotes-reviews`
> (uncommitted, for review). Agents are deliberately minimal: an admin-managed directory plus an inbox for
> linked agency users, because quote routing needs somewhere to send requests. Agency self-onboarding,
> verification, agency-owned packages and performance analytics are not built.

- ✅ `Package`, `PackageDestination`, `PackageTier`, `PackageDay`, `PackageStay`, `PackageInclusion`, `PackagePolicy`, `PackageTag` (fixed departures not modelled)
- 🟡 `Agent`: admin-managed directory with an optional linked login; no self-onboarding or verification
- ✅ Package listing with facets; package detail with tiers, itinerary, hotels, policies, reviews and SEO markup
- ✅ `QuoteRequest` → up to 3 agencies → `Quote` → compare → accept; OTP phone verification (Twilio or dev log)
- ⬜ Notifications: agencies and travellers are not emailed or texted about new requests and quotes yet (in-app only)
- ✅ Scheduled expiry: an hourly housekeeping job expires stale requests and quotes (they still also expire on read)
- ✅ `Review` for packages, destinations and places, with moderation and a verified badge for accepted quotes

### Planner intelligence (weeks 4–6)

> **Update 2026-09-27:** Week 6 is built on `feature/week6-routing-editing-hardening` (uncommitted, for review).

- ✅ Real routing: OSRM road distance, time and polyline, cached in `RouteCache` for 30 days, falling back to a straight-line estimate (labelled in the UI) when the router is down; flights use air distance plus airport time
- ✅ Smarter generator (`db-v2`): long drives split at real towns along the route (per-mode or personal daily drive limit), nearest-next stop grouping, opening hours respected (closed days skipped, no visit ending after closing), lunch and dinner at real food stops nearby, pace (2/3/4 stops a day), coverage reported as full, partial or none
- ✅ Itinerary editing: drag within and across days (and a keyboard menu), add a guide place or your own stop, remove, pin a time, re-plan one day; days re-time automatically and costs refresh; opening-hours warnings on each stop
- ✅ Cost estimate explains itself: fares for bus and flight, local transport, and an assumptions list shown in the Budget tab
- ⬜ "Convert package → my trip" and "Request quote for my trip"
- ⬜ Cost engine v2: per-region rates in the database, fuel prices by state, confidence ranges
- ⬜ Self-hosted OSRM with an India extract (the public demo server is development-only)
- ⬜ PWA offline for saved trips

### Production readiness (continuous)
- ✅ Playwright browser suite in CI (public pages, itinerary editing, quotes, admin publishing), plus API e2e and component tests
- ✅ Dockerfiles for API (with a migrate target) and web, `docker-compose.prod.yml`, `docs/LAUNCH_CHECKLIST.md`
- ✅ Production environment validation, liveness and readiness probes, graceful shutdown, housekeeping job
- ✅ Write rate limits on trips, generation, quote requests and reviews; SSR security headers; real 404 page
- ⬜ Staging environment, backups, Sentry, uptime monitor (operations work)
- ⬜ Nonce-based CSP for scripts; GDPR/DPDP-style data export

---

## 7. Metrics to track from launch

- Planner funnel: `/plan` visit → form valid → sign-in → trip created → itinerary generated → shared.
- Content: destinations and places published, % with ≥ 3 images, % with FAQs, pages indexed.
- Marketplace: quote requests/day, median time to first agent quote, quote → accepted rate.
- Quality: p95 API latency, 5xx rate, Lighthouse mobile score for the destination page, Core Web Vitals.
