# Travel Platform — Product & Engineering Roadmap (next 6 weeks)

_Prepared 2026-09-26 · Based on an audit of `main` @ `ccf1ae1` · Status and issue details: [PROJECT_REPORT.md](./PROJECT_REPORT.md)_

Holidify is used here only as a **product reference**: its information architecture and funnel. No branding, copy, imagery, or layouts are to be reused. All names, sections, and flows below are our own.

---

## 0. How a Holidify-style platform works, and where we differ

**The reference model is a content-led lead-generation funnel:**

```text
Google search ("things to do in X", "X in March")
  → Destination guide / Place page   (SEO traffic, free)
  → Packages for that destination     (commercial intent)
  → "Get quotes" form                 (lead captured; phone is the key field)
  → Lead routed to 1..n travel agents (monetised per lead or per booking)
```

The trip planner is a side feature there. Trips are not really owned by the user, pricing stays opaque until an agent calls, and itineraries are static.

**Our wedge is the reverse:** a road-trip-first planner that users own (vehicle-aware costs, day-wise plans, sharing), wrapped in the same content and SEO funnel, with quotes as monetisation. Every content page has two exits:

1. **"Plan this myself"**: prefilled planner, which produces a user-owned trip.
2. **"Get this arranged"**: a package or quote request, where agents compete on a transparent brief.

Every decision below serves one of three goals: capture search traffic, convert it into owned trips, and monetise through quotes.

---

## 1. Product gap analysis

Legend: ✅ have · 🟡 partial · ❌ missing. Priority: **P0** blocks launch, **P1** needed for the Holidify-class feature set, **P2** differentiator or later.

### 1.1 Discovery and content

| Capability | Current | Gap | Pri |
| --- | --- | --- | --- |
| Global search with autocomplete | 🟡 Locations-only autocomplete in planner and home | Unified search across destinations, places, packages, and collections, with grouped results, aliases (Gurgaon/Gurugram), and typo tolerance (`pg_trgm`) | P1 |
| Duration / month / theme / budget filters | ❌ | Faceted destination and package search | P1 |
| Popular destinations and packages sections | 🟡 Carousels built from the same unranked destination list | `popularityScore`, editorial "featured", per-month trending | P1 |
| Trust stats | ❌ | Real counts (trips planned, destinations, verified agents, avg rating) from `/stats/public`. Never hardcode | P2 |
| Destination hero, rating, best time, quick facts | 🟡 Hero, short description, `bestTimeToVisit` string | Rating, ideal duration, budget per day, altitude, nearest airport and rail, languages, cover gallery | P1 |
| Places to visit | 🟡 Flat list, fake fallback values | Ranked list, category and tag filters, images, time required, fee, link to place page | P1 |
| Hotels / stays | ❌ | `Place` with category `HOTEL` + price band. Real inventory later | P2 |
| How to reach | ❌ | `HowToReach` rows per mode, plus a personalised "from your city" using the routing service | P1 |
| Best time / weather by month | 🟡 Live 7-day forecast only | 12-month climate table, month ratings, events/festivals | P1 |
| Photos | ❌ | `Media` + attachments, licensed/credited, responsive sizes | P0 (content can't ship without it) |
| Map | 🟡 OSM iframe centred on destination, source hardcoded to Gurgaon | Interactive map (MapLibre GL) with place pins and clusters | P1 |
| FAQs | ❌ | `Faq` rows + FAQPage JSON-LD | P1 |
| Similar places | ❌ | Tag-overlap + distance + same-state scoring | P1 |
| Place detail page | ❌ | New page + endpoint (overview, rank, tags, weekly timings, time required, fee matrix, tips, nearby, packages) | P1 |
| Collections / themes | ❌ | `Tag`, `Collection`, `CollectionItem`, collection pages | P1 |
| Blog / long-form | ❌ | Collection body in Markdown is enough for launch. Full blog later | P2 |

### 1.2 Commerce and leads

| Capability | Current | Gap | Pri |
| --- | --- | --- | --- |
| Package listing with filters | ❌ | `Package` + facets + cards (route, N/D, from-price, rating, agent) | P1 |
| Package detail | ❌ | Tiers, day-wise plan, stays, meals, inclusions/exclusions, policies, reviews, similar, quote CTA | P1 |
| Agents / vendors | ❌ | `Agent` with verification (GSTIN), service states, response SLA | P1 |
| Quote request | ❌ | Multi-step form, OTP-verified phone, routing to up to 3 agents, comparison view | P1 |
| Compare quotes | ❌ | Side-by-side normalised quotes (per-person, inclusions diff) | P1 |
| Reviews | ❌ | `Review` with moderation, verified-traveller badge | P1 |

### 1.3 Planner and user-owned data

| Capability | Current | Gap | Pri |
| --- | --- | --- | --- |
| From/To autocomplete | ✅ | Ranking by popularity, aliases, "use my location" | P2 |
| Traveller details | ✅ | Reuse saved co-travellers from profile | P2 |
| Vehicle management | ✅ | Trip must reference `UserVehicle` so custom mileage counts. Default vehicle | P0 |
| Trip generation | 🟡 Deterministic, place-ranked, fixed slots | Real routing, day clustering, opening hours, pace, no duplicate stops, "insufficient data" state | P1 |
| Edit itinerary | ❌ | Reorder/add/remove activities, regenerate a single day | P1 |
| Saved / shared trips | 🟡 Saved = localStorage IDs; share = raw trip URL that leaks PII | Server `SavedItem`, `visibility` + `shareSlug`, public view without travellers | **P0** |
| Auth | 🟡 Email/password, non-expiring custom token | JWT + refresh, OTP (phone), forgot password, guard, 401 handling | **P0** |
| Profile | 🟡 Read-only | Edit profile, preferences (pace, interests, diet, budget band), home city, delete/export account | P1 |
| Offline | 🟡 Online/offline toasts | PWA: cached saved trips and itinerary readable offline | P2 |

### 1.4 Platform

| Capability | Current | Gap | Pri |
| --- | --- | --- | --- |
| SEO rendering | ❌ Client-only SPA | Angular SSR (`@angular/ssr`) + prerender for top pages, meta, canonical, JSON-LD, sitemap | **P0 for content** |
| Admin / CMS | ❌ | Role-gated admin app for content, packages, agents, reviews, quotes, imports | P1 |
| Observability | ❌ | pino logs + request IDs, Sentry (web + api), uptime check | P1 |
| CI/CD | ❌ | GitHub Actions: lint, build, unit, integration (Postgres service), E2E smoke | P0 |

---

## 2. What to build next — priority order and 6-week plan

Rough capacity assumption: 2 engineers (1 backend-leaning, 1 frontend-leaning). With one engineer, allow roughly 10 weeks.

### Week 1 — Lock down and lay foundations (P0)
1. **Auth hardening**: `@nestjs/jwt` + passport-jwt, `JwtAuthGuard`, `OptionalJwtGuard`, `@CurrentUser()`, `RolesGuard`. 15-min access token + rotating refresh token (`RefreshToken` table, httpOnly cookie). Fail boot if `AUTH_TOKEN_SECRET` is missing. `@nestjs/throttler` on `/auth/*`.
2. **Trip authorization**: owner-only list/get/patch/delete. Add `Trip.visibility` + `shareSlug`. Add `GET /public/trips/:shareSlug` (no traveller PII). Update the share button to use the share slug.
3. `Trip.userVehicleId` → `UserVehicle` (migrate data; keep `vehicleId` deprecated for one release). Cost uses `customMileage ?? vehicle.averageMileage`.
4. Invalidate `days` and cost when dates, source, destination, travellers, or vehicle change (set `status = DRAFT`).
5. Real `GET/PATCH /me`, `UserProfile`. Frontend: apply `authGuard` to private routes, clear the session on 401, and silently refresh.
6. Error codes (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION_FAILED` with field map, `RATE_LIMITED`, `INTERNAL`). pino + `x-request-id`.
7. Server-side `SavedItem`. Migrate localStorage IDs on first sign-in.
8. GitHub Actions CI + Testcontainers integration test harness.

### Week 2 — Content data model and admin v0
1. Migrations for `Media`, `MediaAttachment`, `Tag` (+ joins), `Collection`, `CollectionItem`, `Faq`, `DestinationMonthInfo`, `HowToReach`, `PlaceTiming`, rich fields on `Destination` / `Place` / `Location`, `ContentStatus`, `User.role`, `AuditLog`.
2. Media upload: S3-compatible bucket (Cloudflare R2 / S3), presigned PUT, server-side resize to 320/640/1024/1600 WebP + blurhash (sharp worker).
3. Admin app `/admin` (same Angular app, lazy-loaded, `RolesGuard` EDITOR/ADMIN): Destination, Place, Tag, and Collection CRUD with draft → publish.
4. CSV/JSON importer with dry-run diff (`POST /admin/imports?dryRun=true`). Target seed: 50 destinations, 500 places, 15 collections.

### Week 3 — Discovery pages and SEO
1. Angular SSR + route-level prerender for published destinations, places, and collections. `Meta`/`Title` service, canonical URLs, JSON-LD, `sitemap.xml`, `robots.txt`.
2. Destination detail v2 (all sections in §3.3), place detail page, collection page.
3. Explore page with facets (state, theme, month, duration, budget), unified search suggest endpoint (pg_trgm).
4. Home v2: search-first hero, themes rail, trending this month, featured collections, planner CTA.

### Week 4 — Packages and agents
1. Migrations: `Agent`, `Package`, `PackageDestination`, `PackageTier`, `PackageDay`, `PackageDayPlace`, `PackageStay`, `PackageInclusion`, `PackagePolicy`, `PackageTag`.
2. Package listing (facets + sort + pagination) and package detail (tiers, itinerary, stays, policies).
3. Admin: agent onboarding and verification, package editor with day builder and tier matrix, and a package preview in the same SSR route with `?preview=token`.
4. "Customize as my trip": convert a package into a user-owned `Trip` (days/activities copied, `sourcePackageId` kept).

### Week 5 — Quote marketplace and reviews
1. `OtpChallenge` (phone OTP through an SMS provider such as MSG91 or Twilio) and `QuoteRequest` → routing to up to 3 agents (`QuoteRequestAgent`) → `Quote`. Status machine and expiry job.
2. Traveller "My quotes": timeline, side-by-side comparison, accept, and cancel. Agent portal: inbox, respond with a structured quote, and decline.
3. Notifications: email (Resend/SES) + SMS templates. `Notification` table for in-app notifications.
4. Reviews: submit, moderate, and aggregate the rating into target rows (transactional update).

### Week 6 — Planner v2 and launch hardening
1. Routing service: self-hosted OSRM (India extract) or a commercial API behind a `RoutingProvider` interface, with results cached in `RouteCache` keyed by (from, to, mode).
2. Generator v2: day clustering (k-means on place coords, capped by time budget), opening-hours check, pace (RELAXED 2 / BALANCED 3 / PACKED 4 stops), no duplicate stops, meal slots near a real FOOD/CAFE place, and a `coverage` flag when data is thin.
3. Itinerary editing: reorder with CDK drag-drop, add a place from a destination, remove, regenerate a day.
4. Export: `.ics` calendar and print stylesheet (PDF via the browser).
5. Playwright E2E for critical paths, Lighthouse CI budget, Sentry, backups, staging deploy.

**Explicitly deferred** (keep out of the 6 weeks): payments and bookings, live hotel inventory, AI/LLM itinerary generation (the `ITINERARY_GENERATOR` token makes this a drop-in later), group expense split, native apps.

---

## 3. Page architecture

URL rules: lowercase kebab slugs, no IDs in public URLs, one canonical per entity. Everything under `/me/*` requires authentication and is `noindex`.

```text
PUBLIC (SSR, indexable)
/                                           Home
/destinations                               Explore (facets in query string)
/destinations/:destSlug                     Destination guide
/destinations/:destSlug/places              All places (paginated, filterable)
/destinations/:destSlug/places/:placeSlug   Place detail
/destinations/:destSlug/packages            Packages for destination (alias of /packages?destination=)
/packages                                   Package listing
/packages/:packageSlug                      Package detail
/collections/:collectionSlug                Theme collection (hill-stations, weekend-road-trips-from-delhi…)
/t/:shareSlug                               Public shared trip (UNLISTED → noindex, PUBLIC → index)

APP (client-rendered is fine)
/plan                                       Trip planner  (?from=&to=&start=&nights=&packageId= prefill)
/me/trips                                   My trips (merges /itinerary + /trip-details + saved list)
/me/trips/:id                               Trip result / editor (owner)
/me/saved                                   Saved destinations / places / packages / trips
/me/vehicles                                Vehicles
/me/quotes, /me/quotes/:id                  Quote requests + compare
/me/profile                                 Profile + preferences + security
/quote?packageId=|tripId=|destination=      Quote request flow (multi-step)
/sign-in /sign-up /forgot-password /reset-password /verify-phone

ADMIN / AGENT (role-gated, lazy, noindex)
/admin/...   /agent/...
```

Redirects to add: `/trip/:id` → `/me/trips/:id`, `/saved-trips` → `/me/saved`, `/itinerary` and `/trip-details/:id` → `/me/trips`, `/vehicles` → `/me/vehicles`, `/profile` → `/me/profile`, `/explore` → `/destinations`.

### 3.1 Home
1. **Search hero**: one field ("Where to?") with grouped suggestions (Destinations · Places · Packages · Collections), plus two chips: "Plan a road trip" and "Get package quotes". Secondary row: month picker and duration chips (2–3 N, 4–6 N, 7+ N).
2. **Plan from your city**: detects the user's home city (profile, or ask once) and shows 6 destinations with drive time and a cost estimate.
3. **Trending in {current month}**: destinations whose month rating is GOOD for the month, sorted by popularity.
4. **Browse by theme**: tag tiles (Hill stations, Beaches, Heritage, Spiritual, Wildlife, Adventure, Honeymoon, Road trips, Food trails).
5. **Featured packages**: 8 cards.
6. **Collections**: 4 editorial collections.
7. **How it works** (3 steps) + **real trust stats**.
8. **Continue planning**: last draft trip, for signed-in users.

### 3.2 Explore destinations (`/destinations`)
- Left filter rail (bottom sheet on mobile): State, Theme (multi), Best month, Ideal duration, Budget/day band, Distance from my city (needs a home city).
- Sort: Popular · Best for {month} · Nearest · A–Z.
- Grid of destination cards: cover image, name, state, rating, "Best: Oct–Mar", "Ideal 2–3 days", "~₹2.5k/day", save heart.
- Map toggle (list ↔ map with clusters).
- URL-synced filters (`?state=himachal-pradesh&theme=hill-station&month=5`) so filtered views are shareable and crawlable for curated combinations.

### 3.3 Destination detail (`/destinations/:slug`)
Sticky in-page tab bar: Overview · Places · Packages · Best time · How to reach · Stays · Photos · FAQs.
1. **Hero**: gallery (cover + 4 thumbs, "View all N photos"), name, state breadcrumb, rating (n reviews), tags, Save, Share.
2. **Quick facts strip**: Ideal duration · Best time · Budget per day · Altitude · Nearest airport (km) · Nearest railhead (km).
3. **Overview**: 2–3 paragraph intro + "Read more".
4. **Top places**: ranked cards (rank badge, image, category, time required, fee), "See all N places". Filter chips by category.
5. **Plan it**: inline mini planner prefilled with this destination (from = home city, nights = ideal duration) showing live drive time and a cost range → `/plan?to=slug`.
6. **Packages**: 4 cards + "View all".
7. **Best time to visit**: 12-month strip coloured GOOD/OK/AVOID, with temperature, rain, and events per month. Plus live 7-day forecast (labelled "estimated" when the fallback is used).
8. **How to reach**: tabs Road / Train / Air / Bus with distance, time, and cost range. "From {my city}" row computed by routing.
9. **Where to stay**: HOTEL places with price band (no booking yet).
10. **Map**: all places, category-coloured pins.
11. **Reviews**, **FAQs** (accordion), **Similar destinations**, **Nearby destinations** (within 150 km).

### 3.4 Place detail (`/destinations/:d/places/:p`)
1. Breadcrumb (Destination › Places › Place), gallery, name, rank ("#2 of 24 in Rishikesh"), rating, tags.
2. **Key info card**: Open today (computed from `PlaceTiming`, e.g. "Closes 6 pm"), time required, entry fee table (Indian adult / child / foreigner / camera), best time of day, accessibility.
3. Overview, tips list, "Good to know".
4. Mini map + "Directions" deep link, and **Nearby places** (distance-sorted, within 10 km).
5. **Add to my trip** (select an existing trip and day) and **Save**.
6. Packages that include this place, reviews, FAQs.

### 3.5 Package listing (`/packages`)
- Top: destination search + month + duration.
- Filters: State, Destination, Theme, Duration (range), Budget per person (range slider with histogram), Tier, Start city, Agent rating ≥ 4, Customizable.
- Sort: Recommended · Price ↑ · Price ↓ · Duration · Rating.
- **Package card**: cover, title, `4N/5D`, route chips `Manali 2N → Kasol 1N → Kullu 1N`, top 3 inclusions icons (hotel, meals, cab, sightseeing), from-price per person (twin sharing) with strike-through only when a real `compareAtPrice` exists, rating, agent name + verified tick, "Compare" checkbox (up to 3).
- Compare tray (sticky bottom), then a comparison table.

### 3.6 Package detail (`/packages/:slug`)
1. Title, duration, theme tags, route map, rating, agent card (verified, response time, rating).
2. **Tier switcher** (Budget / Mid-range / Premium) that updates price, stays, and meal plan in place. Price box: per person, total for N adults + children, what is included, taxes note.
3. **Day-wise itinerary**: accordion, with day title, places (linked), overnight location, and meals (B/L/D icons).
4. **Stays**: per destination and tier, with hotel name (or similar), category, room type, meal plan (EP/CP/MAP/AP explained).
5. **Inclusions / Exclusions**: two columns.
6. **Policies**: cancellation (table by days before departure), payment, child.
7. **Reviews**, **FAQs**, **Similar packages**.
8. Sticky CTAs: **Get quotes** (primary) · **Customize as my trip** (secondary) · Save.

### 3.7 Trip planner (`/plan`)
Keep the current single-page form. Add:
- **Stepper on mobile** (Route → Dates & people → Vehicle & mode → Interests & pace → Review). A single page with a sticky summary on desktop.
- Live **route preview card**: distance, drive time, and a fuel + toll estimate as soon as From/To are set (via `POST /trips/preview`).
- **Destination coverage indicator**: "We have 24 curated places for Rishikesh" vs "Limited data. We'll build a route-focused plan".
- Pace selector, "Stops along the way" toggle, max driving hours per day (default 8 for car, 6 for bike).
- Guest drafts are saved to localStorage and restored after sign-in (don't lose the form on the auth redirect).

### 3.8 Trip result / editor (`/me/trips/:id`, public `/t/:shareSlug`)
- Header: title (editable), dates, travellers, vehicle, status chip, actions (Share, Duplicate, Export .ics, Print, Request quote, Delete).
- Two-pane on desktop: **day timeline** (left) and **map with the day's route** (right). Tabs on mobile.
- Each activity: time, type icon, place link, drive time from previous, cost. Drag to reorder, ⋯ menu (swap, remove, move to day).
- **Cost panel**: category breakdown with the assumption shown per line ("Stay: ₹1,800 × 2 people × 3 nights, mid-range Himachal rate, updated Sep 2026"), editable overrides, per-person split.
- Weather per day (for dates within 16 days).
- Share modal: visibility PRIVATE / UNLISTED / PUBLIC, copy link, "hide traveller names" (always hidden publicly).

### 3.9 Saved (`/me/saved`)
Tabs: Trips · Destinations · Places · Packages. Card grid, remove, sorted by recency. Empty states link to explore. Optimistic save and unsave.

### 3.10 Vehicles (`/me/vehicles`)
- List of saved vehicles with default star, nickname, model, fuel, effective mileage (custom or catalog), registration (masked on shared views).
- Add flow: type → brand (searchable) → model → optional nickname, mileage, registration.
- Guard on delete: "Used by 3 trips. Trips will keep their cost snapshot."

### 3.11 Auth / profile (`/me/profile`)
- Sign-in with email + password **or** phone OTP. Sign-up collects only name, email or phone, and password. Everything else is optional later.
- Profile sections: Personal (name, phone with verification badge, home city), Travel preferences (interests, pace, diet, budget band, preferred mode), Co-travellers (saved people for quick fill), Security (change password, active sessions and sign-out-all), Privacy (export data, delete account).

### 3.12 Quote request flow (`/quote`)
3 steps, each ≤ 5 fields, progress bar, prefilled from context:
1. **Trip**: destination(s) (prefilled), departure city, start date or "flexible month", nights, tier preference.
2. **People and budget**: adults, children (+ ages), rooms, budget per person range, hotel category, notes.
3. **Contact**: name, phone (OTP verify inline), email, preferred contact time, consent checkbox ("Share my request with up to 3 verified agents").

Confirmation page: what happens next (timeline), expected response time, link to `/me/quotes/:id`. Compare view: normalised per-person price, tier, hotels, inclusions diff (✓/✗ grid), agent rating, validity countdown, Accept/Decline.

---

## 4. Database schema additions (Prisma)

This is a design-level proposal. Some back-relations (for example `Destination.packages`, `Place.media`, `Package.reviews`) are left out for readability, and `prisma format` will add them when the models go into `schema.prisma`. Adopt these in several small migrations, in the order of the weekly plan. Conventions: UUID PKs, `createdAt/updatedAt`, money as `Decimal(12,2)` in INR, `ContentStatus` + `publishedAt` on every public entity, soft delete with `deletedAt` where admins can remove content.

```prisma
// ───────── Enums ─────────
enum UserRole          { TRAVELLER AGENT EDITOR ADMIN }
enum ContentStatus     { DRAFT IN_REVIEW PUBLISHED ARCHIVED }
enum TripVisibility    { PRIVATE UNLISTED PUBLIC }
enum TravelPace        { RELAXED BALANCED PACKED }
enum LocationType      { CITY TOWN VILLAGE AIRPORT RAILWAY_STATION BUS_STAND REGION }
enum TagKind           { THEME ACTIVITY AUDIENCE SEASON }
enum MonthRating       { GOOD OK AVOID }
enum ReachMode         { ROAD TRAIN AIR BUS }
enum PackageTierLevel  { BUDGET MID_RANGE PREMIUM LUXURY }
enum MealPlan          { EP CP MAP AP }          // room only / breakfast / breakfast+dinner / all meals
enum InclusionType     { INCLUSION EXCLUSION }
enum PolicyKind        { CANCELLATION PAYMENT CHILD GENERAL }
enum AgentStatus       { PENDING ACTIVE SUSPENDED }
enum QuoteRequestStatus{ NEW ROUTED QUOTED ACCEPTED CLOSED EXPIRED CANCELLED }
enum QuoteRoutingStatus{ NOTIFIED VIEWED DECLINED QUOTED }
enum QuoteStatus       { SENT WITHDRAWN ACCEPTED REJECTED EXPIRED }
enum ReviewStatus      { PENDING APPROVED REJECTED }
enum TravellerType     { SOLO COUPLE FAMILY FRIENDS BUSINESS }
enum SavedItemType     { TRIP DESTINATION PLACE PACKAGE COLLECTION }
enum OtpPurpose        { SIGN_IN VERIFY_PHONE QUOTE }

// ───────── Identity ─────────
model User {
  // existing fields …
  role            UserRole       @default(TRAVELLER)
  emailVerifiedAt DateTime?
  phoneVerifiedAt DateTime?
  deletedAt       DateTime?
  profile         UserProfile?
  refreshTokens   RefreshToken[]
  savedItems      SavedItem[]
  reviews         Review[]
  quoteRequests   QuoteRequest[]
  agent           Agent?
  @@index([phone])
}

model UserProfile {
  id                   String      @id @default(uuid()) @db.Uuid
  userId               String      @unique @db.Uuid
  homeLocationId       String?     @db.Uuid
  interests            String[]    @default([])
  pace                 TravelPace  @default(BALANCED)
  dietaryPreference    String?     // VEG | NON_VEG | JAIN | VEGAN
  budgetBand           String?     // BUDGET | MID_RANGE | PREMIUM
  preferredTravelMode  TravelMode?
  defaultUserVehicleId String?     @db.Uuid
  marketingOptIn       Boolean     @default(false)
  locale               String      @default("en-IN")
  user                 User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  homeLocation         Location?   @relation(fields: [homeLocationId], references: [id])
  updatedAt            DateTime    @updatedAt
}

model RefreshToken {
  id         String    @id @default(uuid()) @db.Uuid
  userId     String    @db.Uuid
  tokenHash  String    @unique
  familyId   String    @db.Uuid      // rotation chain; reuse ⇒ revoke family
  expiresAt  DateTime
  revokedAt  DateTime?
  userAgent  String?
  ip         String?
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt  DateTime  @default(now())
  @@index([userId])
}

model OtpChallenge {
  id          String     @id @default(uuid()) @db.Uuid
  target      String     // E.164 phone or email
  purpose     OtpPurpose
  codeHash    String
  attempts    Int        @default(0)
  expiresAt   DateTime
  consumedAt  DateTime?
  createdAt   DateTime   @default(now())
  @@index([target, purpose])
}

// ───────── Geography & content ─────────
model Location {
  // existing fields …
  type          LocationType @default(CITY)
  aliases       String[]     @default([])     // "Gurgaon" on the Gurugram row
  district      String?
  popularity    Int          @default(0)       // autocomplete ranking
  destination   Destination?                   // 1:1 when the location is also a guide
  @@unique([name, state])
}

model Destination {
  // existing fields …
  locationId          String?        @unique @db.Uuid
  parentId            String?        @db.Uuid     // Himachal › Kullu Valley › Jibhi
  tagline             String?
  overview            String?        // markdown
  rating              Decimal?       @db.Decimal(2, 1)
  reviewCount         Int            @default(0)
  idealDaysMin        Int?
  idealDaysMax        Int?
  budgetPerDayMin     Decimal?       @db.Decimal(12, 2)
  budgetPerDayMax     Decimal?       @db.Decimal(12, 2)
  altitudeM           Int?
  nearestAirport      String?
  nearestAirportKm    Int?
  nearestRailway      String?
  nearestRailwayKm    Int?
  popularityScore     Int            @default(0)
  isFeatured          Boolean        @default(false)
  status              ContentStatus  @default(DRAFT)
  publishedAt         DateTime?
  seoTitle            String?        @db.VarChar(70)
  seoDescription      String?        @db.VarChar(160)
  location            Location?      @relation(fields: [locationId], references: [id])
  parent              Destination?   @relation("DestinationTree", fields: [parentId], references: [id])
  children            Destination[]  @relation("DestinationTree")
  months              DestinationMonthInfo[]
  howToReach          HowToReach[]
  tags                DestinationTag[]
  @@index([status, state])
  @@index([popularityScore])
}

model DestinationMonthInfo {
  id            String      @id @default(uuid()) @db.Uuid
  destinationId String      @db.Uuid
  month         Int         // 1-12
  rating        MonthRating
  avgMinC       Int?
  avgMaxC       Int?
  rainfallMm    Int?
  notes         String?
  events        String[]    @default([])
  destination   Destination @relation(fields: [destinationId], references: [id], onDelete: Cascade)
  @@unique([destinationId, month])
}

model HowToReach {
  id               String      @id @default(uuid()) @db.Uuid
  destinationId    String      @db.Uuid
  mode             ReachMode
  hubName          String      // "Bhuntar Airport", "Chandigarh Jn"
  distanceKm       Int?
  durationMinutes  Int?
  costMin          Decimal?    @db.Decimal(12, 2)
  costMax          Decimal?    @db.Decimal(12, 2)
  summary          String
  sortOrder        Int         @default(0)
  destination      Destination @relation(fields: [destinationId], references: [id], onDelete: Cascade)
}

model Place {
  // existing fields …
  shortDescription    String?
  overview            String?          // markdown
  rankInDestination   Int?
  timeRequiredMinMin  Int?
  timeRequiredMaxMin  Int?
  entryFeeIndian      Decimal?         @db.Decimal(10, 2)
  entryFeeChild       Decimal?         @db.Decimal(10, 2)
  entryFeeForeigner   Decimal?         @db.Decimal(10, 2)
  feeNotes            String?          // camera, parking, seasonal
  isFree              Boolean          @default(false)
  bestTimeOfDay       String?
  tips                String[]         @default([])
  address             String?
  priceBand           Int?             // 1-4, for HOTEL/FOOD
  reviewCount         Int              @default(0)
  status              ContentStatus    @default(DRAFT)
  publishedAt         DateTime?
  seoTitle            String?          @db.VarChar(70)
  seoDescription      String?          @db.VarChar(160)
  timings             PlaceTiming[]
  tags                PlaceTag[]
  @@index([destinationId, status, rankInDestination])
}

model PlaceTiming {
  id        String  @id @default(uuid()) @db.Uuid
  placeId   String  @db.Uuid
  dayOfWeek Int     // 0 = Sunday
  opensAt   String? // "HH:mm", null when closed
  closesAt  String?
  isClosed  Boolean @default(false)
  place     Place   @relation(fields: [placeId], references: [id], onDelete: Cascade)
  @@unique([placeId, dayOfWeek, opensAt])
}

model Tag {
  id        String   @id @default(uuid()) @db.Uuid
  slug      String   @unique
  name      String
  kind      TagKind
  icon      String?
  destinations DestinationTag[]
  places       PlaceTag[]
  packages     PackageTag[]
}
model DestinationTag {
  destinationId String      @db.Uuid
  tagId         String      @db.Uuid
  destination   Destination @relation(fields: [destinationId], references: [id], onDelete: Cascade)
  tag           Tag         @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([destinationId, tagId])
}
// PlaceTag, PackageTag: same shape.

model Collection {
  id             String          @id @default(uuid()) @db.Uuid
  slug           String          @unique
  title          String
  intro          String
  body           String?         // markdown
  status         ContentStatus   @default(DRAFT)
  publishedAt    DateTime?
  seoTitle       String?         @db.VarChar(70)
  seoDescription String?         @db.VarChar(160)
  items          CollectionItem[]
}
model CollectionItem {
  id            String     @id @default(uuid()) @db.Uuid
  collectionId  String     @db.Uuid
  destinationId String?    @db.Uuid
  placeId       String?    @db.Uuid
  packageId     String?    @db.Uuid
  blurb         String?
  sortOrder     Int
  collection    Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  // + CHECK (num_nonnulls(destination_id, place_id, package_id) = 1)  — raw SQL in migration
}

model Faq {
  id            String   @id @default(uuid()) @db.Uuid
  destinationId String?  @db.Uuid
  placeId       String?  @db.Uuid
  packageId     String?  @db.Uuid
  question      String
  answer        String   // markdown
  sortOrder     Int      @default(0)
  // + CHECK exactly one owner
}

// ───────── Media ─────────
model Media {
  id           String   @id @default(uuid()) @db.Uuid
  storageKey   String   @unique        // r2://bucket/media/2026/09/uuid
  mimeType     String
  width        Int
  height       Int
  bytes        Int
  blurhash     String?
  altText      String                  // required, a11y + SEO
  credit       String?
  license      String                  // OWNED | CC-BY | CC-BY-SA | LICENSED
  sourceUrl    String?
  uploadedById String?  @db.Uuid
  createdAt    DateTime @default(now())
  attachments  MediaAttachment[]
}
model MediaAttachment {
  id            String   @id @default(uuid()) @db.Uuid
  mediaId       String   @db.Uuid
  destinationId String?  @db.Uuid
  placeId       String?  @db.Uuid
  packageId     String?  @db.Uuid
  collectionId  String?  @db.Uuid
  reviewId      String?  @db.Uuid
  isCover       Boolean  @default(false)
  sortOrder     Int      @default(0)
  media         Media    @relation(fields: [mediaId], references: [id], onDelete: Cascade)
  @@index([destinationId, sortOrder])
  @@index([placeId, sortOrder])
  @@index([packageId, sortOrder])
  // + CHECK exactly one owner; partial unique index: one isCover per owner
}

// ───────── Marketplace ─────────
model Agent {
  id               String      @id @default(uuid()) @db.Uuid
  ownerUserId      String      @unique @db.Uuid
  slug             String      @unique
  displayName      String
  legalName        String
  gstin            String?     @unique
  phone            String
  email            String
  city             String
  serviceStates    String[]    @default([])
  status           AgentStatus @default(PENDING)
  verifiedAt       DateTime?
  rating           Decimal?    @db.Decimal(2, 1)
  reviewCount      Int         @default(0)
  medianResponseMin Int?
  maxOpenLeads     Int         @default(20)
  owner            User        @relation(fields: [ownerUserId], references: [id])
  packages         Package[]
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt
}

model Package {
  id               String          @id @default(uuid()) @db.Uuid
  agentId          String          @db.Uuid
  slug             String          @unique
  title            String
  summary          String
  durationDays     Int
  durationNights   Int
  startLocationId  String?         @db.Uuid
  endLocationId    String?         @db.Uuid
  fromPrice        Decimal         @db.Decimal(12, 2)  // denormalised min(tier.pricePerPerson)
  priceBasis       String          @default("PER_PERSON_TWIN_SHARING")
  availableMonths  Int[]           @default([])
  minPax           Int             @default(1)
  maxPax           Int?
  isCustomizable   Boolean         @default(true)
  validFrom        DateTime?       @db.Date
  validTo          DateTime?       @db.Date
  rating           Decimal?        @db.Decimal(2, 1)
  reviewCount      Int             @default(0)
  popularityScore  Int             @default(0)
  status           ContentStatus   @default(DRAFT)
  publishedAt      DateTime?
  seoTitle         String?         @db.VarChar(70)
  seoDescription   String?         @db.VarChar(160)
  agent            Agent           @relation(fields: [agentId], references: [id])
  destinations     PackageDestination[]
  tiers            PackageTier[]
  days             PackageDay[]
  stays            PackageStay[]
  inclusions       PackageInclusion[]
  policies         PackagePolicy[]
  tags             PackageTag[]
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
  @@index([status, fromPrice])
  @@index([status, durationNights])
}

model PackageDestination {       // route summary: Manali 2N → Kasol 1N
  packageId     String @db.Uuid
  destinationId String @db.Uuid
  nights        Int
  sortOrder     Int
  package       Package     @relation(fields: [packageId], references: [id], onDelete: Cascade)
  destination   Destination @relation(fields: [destinationId], references: [id])
  @@id([packageId, sortOrder])
  @@index([destinationId])
}

model PackageTier {
  id               String           @id @default(uuid()) @db.Uuid
  packageId        String           @db.Uuid
  level            PackageTierLevel
  pricePerPerson   Decimal          @db.Decimal(12, 2)
  compareAtPrice   Decimal?         @db.Decimal(12, 2)  // only if a real prior price existed
  childPrice       Decimal?         @db.Decimal(12, 2)
  singleSupplement Decimal?         @db.Decimal(12, 2)
  taxesIncluded    Boolean          @default(false)
  hotelCategory    Int?             // stars
  transportNote    String?          // "Private Innova / Tempo Traveller"
  package          Package          @relation(fields: [packageId], references: [id], onDelete: Cascade)
  stays            PackageStay[]
  @@unique([packageId, level])
}

model PackageDay {
  id                String  @id @default(uuid()) @db.Uuid
  packageId         String  @db.Uuid
  dayNumber         Int
  title             String
  description       String
  overnightDestId   String? @db.Uuid
  mealsIncluded     String[] @default([])   // B, L, D
  package           Package @relation(fields: [packageId], references: [id], onDelete: Cascade)
  places            PackageDayPlace[]
  @@unique([packageId, dayNumber])
}
model PackageDayPlace {
  packageDayId String     @db.Uuid
  placeId      String     @db.Uuid
  sortOrder    Int
  day          PackageDay @relation(fields: [packageDayId], references: [id], onDelete: Cascade)
  @@id([packageDayId, placeId])
}

model PackageStay {
  id            String       @id @default(uuid()) @db.Uuid
  packageId     String       @db.Uuid
  tierId        String       @db.Uuid
  destinationId String       @db.Uuid
  nights        Int
  hotelName     String
  orSimilar     Boolean      @default(true)
  hotelCategory Int?
  roomType      String?
  mealPlan      MealPlan
  package       Package      @relation(fields: [packageId], references: [id], onDelete: Cascade)
  tier          PackageTier  @relation(fields: [tierId], references: [id], onDelete: Cascade)
}

model PackageInclusion {
  id        String        @id @default(uuid()) @db.Uuid
  packageId String        @db.Uuid
  type      InclusionType
  text      String
  icon      String?
  sortOrder Int           @default(0)
  package   Package       @relation(fields: [packageId], references: [id], onDelete: Cascade)
}

model PackagePolicy {
  id        String     @id @default(uuid()) @db.Uuid
  packageId String     @db.Uuid
  kind      PolicyKind
  body      String     // markdown; cancellation as a table by days-before-departure
  package   Package    @relation(fields: [packageId], references: [id], onDelete: Cascade)
  @@unique([packageId, kind])
}

model Review {
  id             String         @id @default(uuid()) @db.Uuid
  userId         String         @db.Uuid
  destinationId  String?        @db.Uuid
  placeId        String?        @db.Uuid
  packageId      String?        @db.Uuid
  agentId        String?        @db.Uuid
  rating         Int            // 1..5, CHECK in SQL
  title          String?        @db.VarChar(120)
  body           String
  travelledMonth DateTime?      @db.Date   // first of month
  travellerType  TravellerType?
  isVerified     Boolean        @default(false)  // linked to accepted quote / completed trip
  status         ReviewStatus   @default(PENDING)
  moderationNote String?
  agentReply     String?
  helpfulCount   Int            @default(0)
  user           User           @relation(fields: [userId], references: [id])
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  @@unique([userId, packageId])
  @@unique([userId, placeId])
  @@unique([userId, destinationId])
  @@index([packageId, status])
  @@index([placeId, status])
}

model QuoteRequest {
  id                 String             @id @default(uuid()) @db.Uuid
  userId             String?            @db.Uuid
  packageId          String?            @db.Uuid
  packageTier        PackageTierLevel?
  tripId             String?            @db.Uuid
  destinationIds     String[]           @db.Uuid
  departureLocationId String?           @db.Uuid
  startDate          DateTime?          @db.Date
  flexibleMonth      Int?               // 1..12 when dates flexible
  nights             Int
  adults             Int
  childAges          Int[]              @default([])
  rooms              Int
  budgetPerPersonMin Decimal?           @db.Decimal(12, 2)
  budgetPerPersonMax Decimal?           @db.Decimal(12, 2)
  hotelCategory      Int?
  notes              String?            @db.VarChar(1000)
  contactName        String
  contactPhone       String             // E.164
  contactEmail       String?
  phoneVerifiedAt    DateTime
  consentAt          DateTime
  source             String             // PACKAGE_PAGE | TRIP_RESULT | DESTINATION | HOME
  utm                Json?
  status             QuoteRequestStatus @default(NEW)
  expiresAt          DateTime
  user               User?              @relation(fields: [userId], references: [id])
  routings           QuoteRequestAgent[]
  quotes             Quote[]
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  @@index([status, createdAt])
  @@index([contactPhone, createdAt])
}

model QuoteRequestAgent {
  quoteRequestId String             @db.Uuid
  agentId        String             @db.Uuid
  status         QuoteRoutingStatus @default(NOTIFIED)
  notifiedAt     DateTime           @default(now())
  viewedAt       DateTime?
  respondedAt    DateTime?
  request        QuoteRequest       @relation(fields: [quoteRequestId], references: [id], onDelete: Cascade)
  @@id([quoteRequestId, agentId])
  @@index([agentId, status])
}

model Quote {
  id              String       @id @default(uuid()) @db.Uuid
  quoteRequestId  String       @db.Uuid
  agentId         String       @db.Uuid
  tier            PackageTierLevel
  totalPrice      Decimal      @db.Decimal(12, 2)
  pricePerPerson  Decimal      @db.Decimal(12, 2)
  taxesIncluded   Boolean
  hotels          Json         // [{destinationId, hotelName, category, mealPlan, nights}]
  inclusions      String[]
  exclusions      String[]
  message         String?
  validUntil      DateTime
  status          QuoteStatus  @default(SENT)
  request         QuoteRequest @relation(fields: [quoteRequestId], references: [id], onDelete: Cascade)
  createdAt       DateTime     @default(now())
  @@unique([quoteRequestId, agentId])
}

// ───────── User-owned ─────────
model SavedItem {              // covers "SavedPackage" and every other saveable
  id            String        @id @default(uuid()) @db.Uuid
  userId        String        @db.Uuid
  type          SavedItemType
  tripId        String?       @db.Uuid
  destinationId String?       @db.Uuid
  placeId       String?       @db.Uuid
  packageId     String?       @db.Uuid
  collectionId  String?       @db.Uuid
  note          String?
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt     DateTime      @default(now())
  @@unique([userId, packageId])
  @@unique([userId, destinationId])
  @@unique([userId, placeId])
  @@unique([userId, tripId])
  @@index([userId, type, createdAt])
}

model Trip {
  // existing fields …
  userVehicleId     String?        @db.Uuid     // replaces vehicleId (catalog)
  destinationId     String?        @db.Uuid     // resolved guide, if any
  sourcePackageId   String?        @db.Uuid
  visibility        TripVisibility @default(PRIVATE)
  shareSlug         String?        @unique     // nanoid(10)
  pace              TravelPace     @default(BALANCED)
  maxDriveHoursDay  Int?
  generatedAt       DateTime?
  generatorVersion  String?
  costAssumptions   Json?          // snapshot of rates used → reproducible, explainable
  costOverrides     Json?
  routePolyline     String?        // encoded polyline
  deletedAt         DateTime?
}

// ───────── Pricing transparency & ops ─────────
model CostRate {
  id            String   @id @default(uuid()) @db.Uuid
  state         String?  // null = national default
  category      String   // STAY_BUDGET | STAY_MID | STAY_PREMIUM | FOOD_DAY | TOLL_PER_KM_CAR | PARKING_DAY …
  amount        Decimal  @db.Decimal(10, 2)
  unit          String   // PER_PERSON_NIGHT | PER_PERSON_DAY | PER_KM | PER_DAY
  source        String
  effectiveFrom DateTime @db.Date
  @@index([category, state, effectiveFrom])
}

model FuelPrice {
  id            String   @id @default(uuid()) @db.Uuid
  state         String
  fuelType      FuelType
  pricePerUnit  Decimal  @db.Decimal(8, 2)   // ₹/litre, ₹/kWh for EV
  effectiveDate DateTime @db.Date
  source        String
  @@unique([state, fuelType, effectiveDate])
}

model RouteCache {
  id              String     @id @default(uuid()) @db.Uuid
  key             String     @unique   // sha1(fromLat,fromLng,toLat,toLng,mode) at 3dp
  distanceKm      Decimal    @db.Decimal(10, 2)
  durationMinutes Int
  polyline        String
  provider        String
  createdAt       DateTime   @default(now())
}

model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  actorId    String?  @db.Uuid
  action     String   // CREATE | UPDATE | PUBLISH | DELETE | MODERATE | IMPORT
  entityType String
  entityId   String
  diff       Json?
  createdAt  DateTime @default(now())
  @@index([entityType, entityId])
}
```

Also add in raw SQL migrations: the `pg_trgm` extension with GIN indexes on `Location.name`, `Destination.name`, `Place.name`, and `Package.title`. Enable `postgis` and generated `geography(Point)` columns on `Place`/`Destination` for "nearby" queries once they are needed (the image already supports PostGIS).

---

## 5. API endpoints by page

All under `/api/v1`. **Pub** = public and cacheable (`Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`). **Auth** = JWT required. **Role** = role-gated. List endpoints return `{ items, page, pageSize, total }`.

| Page | Endpoint | Access |
| --- | --- | --- |
| **Global** | `GET /search/suggest?q=&limit=` → `{destinations[], places[], packages[], collections[], locations[]}` | Pub |
| | `GET /tags?kind=THEME` | Pub |
| **Home** | `GET /home?month=&fromLocation=` → featured collections, trending destinations, featured packages, themes, stats | Pub |
| | `GET /stats/public` | Pub |
| **Explore** | `GET /destinations?q&state&tag[]&month&durationDays&budgetMax&near=lat,lng&sort&page&pageSize` | Pub |
| | `GET /destinations/facets?…same filters` → counts per state, tag, month | Pub |
| **Destination** | `GET /destinations/:slug` → core, quick facts, cover + 5 media, tags, rating | Pub |
| | `GET /destinations/:slug/places?category&tag&sort=rank&page` | Pub |
| | `GET /destinations/:slug/months` · `/how-to-reach?from=:locationSlug` · `/faqs` · `/media?page` · `/similar?limit=6` · `/nearby?radiusKm=150` | Pub |
| | `GET /destinations/:slug/packages?limit=4` | Pub |
| | `GET /reviews?destinationId=&page` | Pub |
| | `GET /weather/forecast?latitude&longitude&startDate` (add `isEstimated` flag) | Pub |
| **Place** | `GET /destinations/:destSlug/places/:placeSlug` → incl. timings, `openNow`, fees, tips, tags | Pub |
| | `GET /places/:id/nearby?radiusKm=10&limit=8` · `GET /places/:id/packages` | Pub |
| **Packages** | `GET /packages?destination&state&month&nightsMin&nightsMax&tag[]&priceMin&priceMax&tier&startCity&agent&sort&page` | Pub |
| | `GET /packages/facets?…` (incl. price histogram buckets) | Pub |
| | `GET /packages/compare?ids=a,b,c` | Pub |
| **Package detail** | `GET /packages/:slug` → tiers, days (+places), stays, inclusions, policies, agent summary, faqs | Pub |
| | `GET /packages/:slug/similar` · `GET /reviews?packageId=` | Pub |
| | `POST /packages/:slug/customize` → creates a `Trip` from the package | Auth |
| **Planner** | `GET /locations/suggest?q&limit` (aliases, popularity) | Pub |
| | `POST /trips/preview` → adds `route {distanceKm, durationMinutes, polyline}`, `costEstimate {min,max,breakdown}`, `coverage {destinationSlug, placeCount}` | Pub (rate-limited) |
| | `GET /routing/estimate?from=lat,lng&to=lat,lng&mode` | Pub (rate-limited) |
| | `POST /trips` · `POST /trips/:id/generate-itinerary` | Auth |
| **Trip result** | `GET /trips/:id` · `PATCH /trips/:id` · `DELETE /trips/:id` (soft) | Auth (owner) |
| | `PATCH /trips/:id/visibility` → `{visibility, shareSlug}` | Auth (owner) |
| | `GET /public/trips/:shareSlug` (no travellers, masked reg. number) | Pub |
| | `POST /trips/:id/days/:dayNumber/activities` · `PATCH /trips/:id/activities/:activityId` · `DELETE …` · `PUT /trips/:id/days/:dayNumber/order` `{activityIds[]}` · `POST /trips/:id/days/:dayNumber/regenerate` | Auth (owner) |
| | `POST /trips/:id/duplicate` · `GET /trips/:id/export.ics` · `PATCH /trips/:id/cost-overrides` | Auth (owner) |
| **My trips** | `GET /me/trips?status&page` | Auth |
| **Saved** | `GET /me/saved?type&page` · `PUT /me/saved/:type/:id` · `DELETE /me/saved/:type/:id` · `POST /me/saved/import` `{tripIds[]}` (localStorage migration) | Auth |
| **Vehicles** | `GET /vehicles/brands?type` · `GET /vehicles?type&fuelType&brand&q` | Pub |
| | existing `/vehicles/my…` + `POST /vehicles/my/:id/default` | Auth |
| **Auth** | `POST /auth/register` · `/auth/login` · `/auth/refresh` · `/auth/logout` · `/auth/logout-all` | Pub/Auth |
| | `POST /auth/otp/request` `{target, purpose}` · `POST /auth/otp/verify` | Pub (rate-limited) |
| | `POST /auth/password/forgot` · `POST /auth/password/reset` · `POST /auth/email/verify` | Pub |
| **Profile** | `GET /me` · `PATCH /me` · `PATCH /me/profile` · `POST /me/password` · `GET /me/sessions` · `GET /me/export` · `DELETE /me` | Auth |
| **Quotes (traveller)** | `POST /quote-requests` (requires a `phoneVerificationToken` from OTP verify) | Pub/Auth |
| | `GET /me/quote-requests` · `GET /me/quote-requests/:id` (+quotes) · `POST /me/quote-requests/:id/cancel` · `POST /me/quotes/:quoteId/accept` · `POST /me/quotes/:quoteId/decline` | Auth |
| **Quotes (agent)** | `GET /agent/quote-requests?status` · `GET /agent/quote-requests/:id` (marks viewed) · `POST /agent/quote-requests/:id/quotes` · `POST /agent/quote-requests/:id/decline` · `PATCH /agent/quotes/:id` (withdraw) | Role AGENT |
| | `GET/POST/PATCH /agent/packages…` · `GET /agent/profile` | Role AGENT |
| **Reviews** | `POST /reviews` · `PATCH /reviews/:id` (own, while PENDING) · `POST /reviews/:id/helpful` | Auth |
| **Admin** | `CRUD /admin/destinations|places|tags|collections|faqs|packages|agents|cost-rates|fuel-prices` | Role EDITOR/ADMIN |
| | `POST /admin/:entity/:id/publish` · `/unpublish` · `GET /admin/:entity/:id/preview-token` | Role EDITOR |
| | `POST /admin/media/presign` → `{uploadUrl, storageKey}` · `POST /admin/media` (finalise, runs resize) · `PATCH/DELETE /admin/media/:id` | Role EDITOR |
| | `POST /admin/imports?entity=places&dryRun=true` (CSV/JSON) → diff report | Role ADMIN |
| | `GET /admin/reviews?status=PENDING` · `POST /admin/reviews/:id/moderate` | Role EDITOR |
| | `POST /admin/agents/:id/verify|suspend` · `GET /admin/quote-requests` · `POST /admin/quote-requests/:id/reroute` | Role ADMIN |
| | `GET /admin/audit-log?entityType&entityId` · `GET /admin/content-health` | Role ADMIN |
| **SEO** | `GET /seo/sitemap-index.xml` · `/seo/sitemaps/:type-:page.xml` (served by the SSR host) | Pub |

---

## 6. UI/UX improvements by page (on existing pages)

**Global**
- Replace hardcoded hex colours in 14 component files with design tokens (`--surface`, `--on-surface`, `--muted`, `--accent`, `--danger`) so dark mode is consistent. Define a type scale and 4/8 px spacing tokens.
- Skeleton loaders shaped like the content (card grid, day timeline) instead of spinners for anything above 300 ms. Keep spinners for button actions.
- Error states: distinguish offline ("You're offline. Showing saved copy"), 401 (auto refresh, then sign-in prompt that preserves the route), 404 (suggest search), 5xx (retry button + request ID).
- Bottom navigation on mobile (Home · Explore · Plan · Trips · Profile). Header search collapses to an icon.
- Respect `prefers-reduced-motion`. Focus rings. All images need `alt` (enforced at the Media level). Minimum tap targets of 44 px.
- `NgOptimizedImage` with `srcset`, blurhash placeholders, and `priority` on hero images only.

**Home**: search-first hero instead of a long form. Move the full quick-planner form to `/plan` and keep only From/To/Dates/Go on the home page. Show real stats, or none.

**Explore**: currently the same list appears three times (trending, popular, budget). Replace it with real, differentiated rails (by popularity, month rating, budget band) and a faceted grid.

**Destination detail**: remove the hardcoded Gurgaon source (use the profile home city, or show the destination pin only). Never render fallback numbers (`4.2/5`, `60 min`, `₹0`); hide the field instead. Add a sticky section nav and a "Plan this trip" CTA that carries the slug.

**Planner**: keep the form state across the sign-in redirect. Show coverage and route preview before submit. Validate inline on blur, not only on submit. Show a traveller summary chip ("2 adults, 1 child"). Add a "Use my saved vehicle" default.

**Trip result**: show "Built with limited place data" when coverage is thin. Label the weather fallback as estimated. Show the assumption behind each cost line. Collapse past days. Add a print stylesheet. Share should use the share slug and offer a visibility choice.

**Saved / Itinerary / Trip-details**: merge into `/me/trips` with filters (Upcoming · Drafts · Past · Saved) to remove three overlapping pages.

**Vehicles**: searchable brand/model selector, default vehicle, effective mileage shown with its source ("custom" vs "catalog avg").

**Auth**: add phone OTP, show/hide password, strength meter, "forgot password", and a return-to-previous-page redirect. Rate-limit errors should show a countdown.

---

## 7. Validation rules and edge cases

### 7.1 Field rules (API is the source of truth; mirror on the client)

| Field | Rule |
| --- | --- |
| Name (user, traveller, quote contact) | 2–80 chars, Unicode letters, space, `.'-` (current regex is ASCII-only; switch to `\p{L}` so names like "Ananyā" or "Múrcia" pass) |
| Email | RFC-valid, lowercased, trimmed, ≤ 254 chars, unique among non-deleted users |
| Phone | Normalise to E.164 (`+91XXXXXXXXXX`); Indian mobile `^[6-9]\d{9}$` after stripping `+91`/`0`; OTP-verified before quote submit |
| Password | ≥ 10 chars, not in top-10k breached list, not equal to email; max 128 |
| OTP | 6 digits, 5-min TTL, max 5 attempts per challenge, max 3 sends per target per 15 min, 60 s resend cooldown |
| Trip dates | `startDate ≥ today (IST)`; `endDate ≥ startDate`; duration ≤ 30 days; `startDate ≤ today + 18 months` |
| Travellers | 1–20 per trip; `travellerCount === travellers.length` (drop the redundant field entirely); age 0–120; at least one traveller ≥ 18 |
| Source/destination | Must differ (≥ 5 km apart); coordinates inside India's bounding box for v1 (lat 6–37.5, lng 68–97.5) |
| Budget | 0 – ₹10,00,000; optional; warn (not block) if below the estimated minimum |
| Interests/preferences | Whitelisted slugs from `Tag`, max 10 |
| Notes | ≤ 1000 chars, strip HTML |
| Vehicle registration | Existing RTO/BH regex (good); unique per user; masked on public views |
| Custom mileage | 1–200 km/l (km/kWh for EV); must not be > 3× catalog average without confirmation |
| Package | `durationDays = durationNights + 1` (or `= nights`, which is allowed for overnight arrivals); `sum(PackageDestination.nights) = durationNights`; `PackageDay` numbers contiguous 1..durationDays; each tier has stays covering all nights; `compareAtPrice > pricePerPerson` when present |
| Quote request | `adults ≥ 1`, `adults + children ≤ 30`, `rooms ≥ ceil(adults/3)`; `childAges` each 0–17 and length = children; `budgetMin ≤ budgetMax`; either `startDate` or `flexibleMonth`; consent required |
| Review | rating 1–5 int; body 30–3000 chars; one per user per target; editable only while PENDING |
| Slugs | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤ 80, unique per scope; changing a published slug creates a 301 `SlugRedirect` |
| SEO fields | title ≤ 60–70 chars; description 120–160 chars; warn in admin |
| Media | JPEG/PNG/WebP/AVIF, ≤ 10 MB, ≥ 1200 px wide for covers; `altText` required; license required |

### 7.2 Edge cases to handle explicitly
- **Same-day trip** (start = end) is already handled as a single day. Make sure the cost doesn't charge a stay night (it doesn't today; keep a test for it).
- **Destination without guide data**: generate a route-only plan and set `coverage = NONE`. The UI explains this and suggests nearby covered destinations.
- **More days than places**: fill spare days with "free / rest day" or nearby-destination suggestions. Never duplicate stops.
- **Place closed on the planned weekday**: the generator skips it or moves it to another day, and the UI shows a warning if the user drags it onto a closed day.
- **Long drives**: if one-way drive time exceeds `maxDriveHoursDay`, insert an overnight halt at the midpoint town (nearest `Location` to the route midpoint).
- **FLIGHT/BUS mode**: no fuel or tolls; use fare ranges from `HowToReach` instead, and mark the cost "indicative".
- **EV**: cost uses ₹/kWh and range. Warn when a leg exceeds 80% of range and there is no known charger (later).
- **Timezone**: all date-only fields use `@db.Date`. Compute "today" in `Asia/Kolkata` on the server; never use `new Date().toISOString().slice(0,10)` on the client (it gives the UTC date between 00:00 and 05:30 IST).
- **Concurrent edits** on a trip in two tabs: add an `updatedAt` precondition (`If-Match` / `version` field) and return 409 on conflict.
- **Double submit** of trip create or quote request: use an `Idempotency-Key` header, stored for 24 h.
- **Deleted vehicle referenced by trips**: `onDelete: SetNull` plus the trip keeps `costAssumptions` so its numbers don't change.
- **Unpublished content** in saved items, collections, or old trips: show a "no longer available" card and never 500.
- **Slug change**: 301 from the old slug, and old share links keep working.
- **Agent suspended mid-quote**: hide their quotes, reroute the request, and notify the user.
- **Quote expiry**: a nightly job sets EXPIRED and notifies. Accepting an expired quote returns 409.
- **Duplicate leads**: same phone + destination within 7 days → attach to the existing request instead of creating a new one.
- **Autocomplete**: debounce 250 ms, cancel in-flight requests (`switchMap`), minimum 2 chars, handle an empty result and a 503 (table missing) gracefully, and keep keyboard navigation.
- **Offline during generation**: disable the button, queue nothing, keep the form state.

---

## 8. SEO and content strategy

### 8.1 Technical
- **Angular SSR** (`ng add @angular/ssr`), with hydration already wired. Prerender published destination, place, collection, and package pages at build time, or with on-demand ISR-style caching at the CDN (cache public HTML for 10 min, stale-while-revalidate 1 day, purge on publish).
- Per-route `Title` + `Meta` (description, `og:*`, `twitter:card`), `<link rel="canonical">`, `hreflang` later.
- **JSON-LD**: `TouristDestination` (destination), `TouristAttraction` with `openingHoursSpecification` (place), `Product` + `Offer` + `AggregateRating` (package, only with real reviews), `FAQPage`, `BreadcrumbList`, `ItemList` (collections and listings), `Organization` (home).
- Sitemaps split by type, ≤ 50k URLs each, `lastmod` from `updatedAt`. Include only PUBLISHED, non-deleted content.
- Faceted URLs: index only curated combinations (for example `/packages?destination=manali&nights=4-6` exposed as `/packages/manali-4-to-6-nights`). Everything else gets `noindex,follow` plus a canonical to the base listing.
- Performance budget: LCP < 2.5 s on 4G mobile, CLS < 0.1, JS for the destination route < 200 KB gzipped. Lighthouse CI in the pipeline.
- `noindex` on `/me/*`, `/admin/*`, `/agent/*`, `/quote`, auth pages, and UNLISTED shared trips.

### 8.2 URL and title patterns
| Page | URL | Title template |
| --- | --- | --- |
| Destination | `/destinations/rishikesh` | `Rishikesh Travel Guide {year}: Places, Best Time, How to Reach` |
| Place | `/destinations/rishikesh/places/beatles-ashram` | `Beatles Ashram, Rishikesh: Timings, Entry Fee, Tips` |
| Places list | `/destinations/rishikesh/places` | `{N} Best Places to Visit in Rishikesh` |
| Package | `/packages/rishikesh-mussoorie-4n-5d-xyz` | `Rishikesh & Mussoorie 4N/5D Package from ₹{fromPrice}` |
| Collection | `/collections/weekend-road-trips-from-delhi` | `{N} Weekend Road Trips from Delhi (with drive times)` |

### 8.3 Content model and editorial rules
- **Every destination** at publish needs: ≥ 150-word overview, ≥ 5 published places, ≥ 3 licensed images (1 cover), 12 month rows, ≥ 2 how-to-reach rows, ≥ 4 FAQs, ≥ 2 tags, SEO title and description. Enforce this with an admin "content health" score that blocks publishing below the threshold.
- **Every place**: ≥ 80-word overview, timings or an "open 24h / check locally" flag, fee or `isFree`, time required, ≥ 1 image, category, ≥ 1 tag.
- **Unique value we can publish that static guides can't**: drive time and cost from the top 10 cities (computed), vehicle-specific fuel cost, live weather, and "road-trip ready" data such as fuel/EV stops and mechanic/hospital places (the `FUEL`/`HOSPITAL`/`MECHANIC` categories already exist in `PlaceCategory`).
- **Collections** to launch (programmatic + editorial): weekend road trips from {Delhi, Mumbai, Bengaluru, Pune, Hyderabad, Chennai, Kolkata}; hill stations; beaches; heritage; spiritual; wildlife; honeymoon; monsoon trips; winter snow; budget under ₹10k; bike trips; EV-friendly routes.
- **Internal linking**: destination ↔ places ↔ packages ↔ collections, plus "nearby" and "similar" modules, and breadcrumbs everywhere.
- **Content sourcing**: write original content, use owned photos or properly licensed stock (CC-BY with credit, or paid licence) with `license` and `credit` stored. Never scrape or copy text or images from Holidify or any other site.
- **Freshness**: `updatedAt` shown as "Updated Sep 2026", with a quarterly review queue in admin (content older than 180 days).

---

## 9. Testing strategy

### 9.1 Backend
- **Unit (Vitest, already set up)**: pure logic in isolation.
  - `TripCostService`: per mode (FLIGHT has no fuel), EV, custom mileage precedence, zero nights, rate lookup by state with fallback to national.
  - `DatabaseItineraryGenerator` v2: no duplicate stops, closed-day skipping, pace limits, long-drive halt insertion, coverage flag, deterministic output for a fixed seed.
  - Validators: phone normalisation, registration, package consistency, quote request rules, slug rules.
  - Quote state machine: allowed and forbidden transitions.
- **Integration (Vitest + `@nestjs/testing` + Supertest + Testcontainers Postgres 16)**: run migrations and a fixture seed per suite, wrapping each test in a transaction that rolls back.
  - **AuthZ matrix test**, the most important one: for every `/trips`, `/me/*`, `/vehicles/my`, `/agent/*`, and `/admin/*` route, assert 401 without a token, 403/404 for another user's resource, and 200 for the owner. This would have caught all four P0 issues.
  - Public share returns no traveller data.
  - Refresh token rotation, and reuse detection revoking the family.
  - OTP limits and expiry.
  - Filters and facets on `/destinations` and `/packages` return correct counts.
  - Import dry-run produces a diff and doesn't write.
  - Publish workflow: DRAFT content is never returned by public endpoints.
- **Contract**: generate an OpenAPI spec in CI and fail if it breaks without a version bump. Optionally generate the frontend client with `openapi-typescript` so DTOs never drift.

### 9.2 Frontend
- Wire the web `test` script to discover `**/*.spec.ts` (it currently lists two files).
- **Component tests** (Vitest + Angular TestBed or `@testing-library/angular`, jsdom):
  - Planner: validation messages, traveller rows matching the count, date rules in IST, form restore after sign-in redirect, submit disabled while generating.
  - Autocomplete: debounce, cancellation, empty state, keyboard selection.
  - Trip result: renders coverage warning, estimated-weather label, cost assumption lines; share modal visibility changes.
  - Package detail: tier switch updates price and stays; compare tray limit of 3.
  - Quote flow: step validation, OTP input, back/forward preserving state.
  - Interceptor: 401 triggers one refresh then a retry; a second 401 clears the session.
  - Guards: redirect to sign-in with `returnUrl`.
- **Visual/a11y**: axe checks in component tests for key pages; Storybook optional.

### 9.3 End-to-end (Playwright, against docker-compose API + seeded DB)
1. Guest browses home → destination → place → package (SSR HTML contains title and JSON-LD).
2. Guest plans a trip → redirected to sign-up → returns with form intact → generates → sees days and cost.
3. Owner shares an UNLISTED link → an incognito context sees the trip without traveller names → another signed-in user also sees it (regression for P0 #4).
4. User B cannot GET, PATCH, or DELETE user A's trip through the API (regression for P0 #1 and #2).
5. Save/unsave destination and package; saved items persist across a new browser context.
6. Vehicle add → set default → planner preselects it → cost reflects custom mileage.
7. Quote: package → quote flow with OTP (test SMS provider stub) → agent logs in and quotes → traveller compares and accepts.
8. Admin creates a destination draft (not public) → publishes it (appears in sitemap and listing).
9. Mobile viewport (Pixel 7) runs of flows 1, 2, and 7. Dark mode screenshot diff on home and trip result.
10. Offline: with a saved trip opened once, going offline still renders it (after the PWA work).

CI gates: unit + integration on every PR, E2E smoke (flows 1–4) on every PR, full E2E nightly, Lighthouse CI on the destination and package routes.

---

## 10. Admin and data-management features

**Roles:** EDITOR (content), ADMIN (everything plus agents, imports, users), AGENT (own packages and quotes through `/agent`).

1. **Content CRUD with workflow**: Destination, Place, Tag, Collection, FAQ, and Package editors. States DRAFT → IN_REVIEW → PUBLISHED → ARCHIVED, a "preview as public" link (signed token), scheduled publish (`publishedAt` in the future).
2. **Content health dashboard**: per-entity score against the §8.3 rules, filters like "destinations missing month data" or "places without images", and a stale-content queue (> 180 days).
3. **Media library**: drag-drop upload (presigned), auto-resize, alt text and licence required, "used in" references, replace image while keeping attachments, block deletion while referenced.
4. **Bulk import/export**: CSV/JSON for locations, destinations, places, timings, and packages. Dry-run diff (create/update/skip with row errors), idempotent on slug, export of any listing to CSV.
5. **Geo tools**: map picker for coordinates, duplicate detection (same name within 1 km, or alias match, which would have flagged Gurgaon/Gurugram), merge tool that repoints FKs.
6. **Location aliases and autocomplete ranking** editor (popularity boost).
7. **Pricing tables**: `CostRate` and `FuelPrice` editors with effective dates. The trip cost panel cites them.
8. **Agents**: onboarding queue, GSTIN and document check, verify/suspend, lead cap, performance (response time, quote rate, acceptance rate, rating).
9. **Leads**: quote request inbox with status filters, manual reroute, duplicate merge, SLA breach alerts (no quote within 12 h).
10. **Reviews moderation**: queue, approve/reject with reason, profanity/PII auto-flag, agent reply moderation.
11. **Users**: search, view (PII access is logged), disable, role change, GDPR/DPDP export and delete.
12. **Audit log**: every admin write stored with a diff. Viewable per entity.
13. **Redirects**: automatic on slug change, plus a manual editor for legacy URLs.
14. **Ops**: feature flags (simple `FeatureFlag` table), maintenance banner, cache purge on publish.

Build the admin inside the existing Angular app as a lazy `admin` route bundle using Angular Material tables and forms. This is faster than adopting a separate CMS and reuses DTOs and validation.

---

## 11. How to make this better than Holidify

| Theme | Concrete implementation |
| --- | --- |
| **Modern UI** | Design tokens + consistent dark mode. Image-led cards with blurhash. Sticky section nav on long pages. Bottom nav and bottom-sheet filters on mobile. Skeletons. Map/list toggle. Motion kept under 200 ms with reduced-motion respected. |
| **Itinerary personalisation** | Profile preferences (pace, interests, diet, budget band) feed the generator. Per-day regenerate. Drag-edit. "Swap for something similar" using tag overlap. Opening-hours aware. Kids/senior-friendly filters based on traveller ages already captured. |
| **Real user-owned trips** | Trips are first-class, editable, duplicable, exportable (.ics / print), shareable with visibility control, and survive package changes (copy on customize). A package becomes "my trip" with one click; quotes can be requested for *my* trip, not just a catalogue package. |
| **Transparent pricing** | Every cost line shows its formula and source (`CostRate`, `FuelPrice` by state and date). Low–high range instead of a fake-precise number. User overrides. Packages show per-person price basis, taxes-included flag, and real `compareAtPrice` only. Quotes are normalised for apples-to-apples comparison. |
| **Saved vehicles** | Default vehicle. Custom mileage actually used. EV range warnings. Bike-specific daily ride-hour limits. Per-vehicle fuel cost on destination pages ("₹2,340 fuel in your Creta"). |
| **Smarter route planning** | Real road distance and time (OSRM) with cached polylines. Overnight halt insertion for long drives. Stops along the way (viewpoints, food, fuel, EV chargers). Mode-aware costs. Day clustering to minimise backtracking. Later: traffic-aware departure suggestions. |
| **Loading / error / offline** | Skeletons per layout. Typed error codes mapped to specific UI. Silent token refresh. Idempotent retries. PWA service worker caching the app shell plus saved trips (read-only offline). "Last synced" badge. Offline-safe weather labels. |
| **Mobile** | Planner stepper. Thumb-reachable CTAs. Tap-to-call agent. Share sheet. Map as a full-screen modal. Images sized per viewport. Lighthouse mobile ≥ 90 as a CI gate. |
| **Trust** | Verified agents (GSTIN), verified-traveller reviews only, visible response-time SLAs, no dark patterns (the user chooses how many agents see the lead, max 3, and can withdraw), and a clear consent record. |

---

## Appendix A — Suggested ticket breakdown (first sprint)

1. `api/auth`: JWT access + refresh, guards, `@CurrentUser`, required secret, throttler.
2. `api/trips`: owner-only queries, visibility + shareSlug, public endpoint, authz matrix tests.
3. `api/trips`: `userVehicleId` migration + cost uses custom mileage; invalidate on edit.
4. `api/common`: error codes, pino, request ID, 409/429 mapping.
5. `api/users`: `/me`, `UserProfile`, password change.
6. `api/saved`: `SavedItem` CRUD + localStorage import.
7. `web/core`: interceptor refresh + 401 handling, guards on private routes, returnUrl.
8. `web/planner`: persist draft across auth redirect; IST "today".
9. `web/trips`: merge itinerary / trip-details / saved into `/me/trips`; share modal.
10. `web/theme`: token pass over the 14 files with hex colours.
11. `ci`: GitHub Actions (build, unit, integration with Postgres service), `prisma validate`, `prisma migrate diff` check.
