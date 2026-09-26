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
- ⬜ Schema: `Media`, `Tag`, `Collection`, rich `Destination`/`Place` fields, `Location` ↔ `Destination` link, `PlaceTiming`, `DestinationMonthInfo`, `HowToReach`, `Faq`
- ⬜ Place detail page + endpoint; destination page sections (quick facts, best time, how to reach, FAQs, similar places)
- ⬜ Collections pages (hill stations, heritage, road trips…)
- ⬜ Admin CMS v1 (CRUD + publish workflow + media upload)
- ⬜ Seed/import pipeline (CSV/JSON) for ≥ 50 destinations and ≥ 500 places
- ⬜ SSR/prerender + meta/JSON-LD + sitemap

### Marketplace (weeks 3–5)
- ⬜ `Agent`, `Package`, `PackageTier`, `PackageDay`, `PackageStay`, `PackageInclusion`, `PackagePolicy`, `PackageDeparture`
- ⬜ Package listing with facets; package detail with tiers and itinerary
- ⬜ `QuoteRequest` → `Quote` (multi-agent) → compare → accept; OTP phone verification; notifications
- ⬜ `Review` with moderation

### Planner intelligence (weeks 4–6)
- ⬜ Real routing (OSRM or a commercial routing API) with cached polylines
- ⬜ Place clustering per day, opening-hours awareness, pace setting, drag-reorder editing
- ⬜ "Convert package → my trip" and "Request quote for my trip"
- ⬜ Cost engine v2: per-mode, per-region rates in DB, fuel prices by state, confidence ranges
- ⬜ PWA offline for saved trips

### Production readiness (continuous)
- ⬜ Integration tests (Testcontainers Postgres), component tests, Playwright E2E
- ⬜ Dockerfiles, staging environment, backups, Sentry, uptime monitor
- ⬜ Rate limiting, CSP tuning, audit log, GDPR/DPDP-style data export and delete

---

## 7. Metrics to track from launch

- Planner funnel: `/plan` visit → form valid → sign-in → trip created → itinerary generated → shared.
- Content: destinations and places published, % with ≥ 3 images, % with FAQs, pages indexed.
- Marketplace: quote requests/day, median time to first agent quote, quote → accepted rate.
- Quality: p95 API latency, 5xx rate, Lighthouse mobile score for the destination page, Core Web Vitals.
