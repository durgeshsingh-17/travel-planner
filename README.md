# Travel Platform

India-first travel and road-trip planning platform for route planning, structured day-wise itineraries, vehicle-aware cost estimates, saved trips, and shareable trip plans.

This repository is the Phase 1 foundation for a production-minded MVP. AI itinerary generation, bookings, offers, group trips, expense splitting, SOS, offline support, RAG, and recommendations are intentionally out of scope until the core product flow is stable.

## Architecture

```text
travel-platform/
  apps/
    web/      Angular standalone frontend
    api/      NestJS REST API
  docs/       Architecture notes
  docker/     Docker support assets
  docker-compose.yml
```

The backend is a modular monolith. PostgreSQL is the primary database, with a PostGIS image selected so geo features can be added without changing the storage foundation. Redis is documented in Docker Compose but disabled until there is a real cache requirement.

## Tech Stack

- Frontend: Angular, TypeScript, standalone components, Angular Router, SCSS, Signals-ready feature architecture.
- Backend: Node.js, NestJS, TypeScript, REST, Swagger/OpenAPI, `class-validator`, `class-transformer`.
- Database: PostgreSQL with PostGIS-ready Docker image, Prisma ORM, UUID primary keys, migrations.

## Local Setup

Install dependencies:

```bash
npm install
```

Copy environment variables:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

Start PostgreSQL:

```bash
npm run db:up
```

Generate the Prisma client:

```bash
npm run prisma:generate
```

Create or apply database migrations:

```bash
npm run prisma:migrate
```

Run the API:

```bash
npm run dev:api
```

Run the frontend:

```bash
npm run dev:web
```

## Environment Variables

| Variable | Description |
| --- | --- |
| `API_PORT` | Port for the NestJS API. |
| `API_CORS_ORIGIN` | Allowed frontend origin. |
| `DATABASE_URL` | Prisma PostgreSQL connection string. |
| `POSTGRES_USER` | Local PostgreSQL user. |
| `POSTGRES_PASSWORD` | Local PostgreSQL password. |
| `POSTGRES_DB` | Local PostgreSQL database. |
| `POSTGRES_PORT` | Local PostgreSQL port. |
| `AUTH_TOKEN_SECRET` | **Required.** HMAC secret for sign-in tokens, at least 32 characters. The API refuses to start without it. Generate with `openssl rand -base64 48`. |
| `AUTH_ACCESS_TOKEN_TTL_SECONDS` | Access token lifetime. Defaults to `900` (15 minutes). The app refreshes it silently. |
| `AUTH_REFRESH_TOKEN_TTL_DAYS` | Refresh token lifetime (httpOnly cookie, rotated on every use). Defaults to `30`. |
| `AUTH_RATE_LIMIT_PER_MINUTE` | Per-IP limit for sign-in, sign-up, refresh and password endpoints. Defaults to `10`. |
| `API_RATE_LIMIT_PER_MINUTE` | Per-IP limit for everything else. Defaults to `300`. |
| `TRUST_PROXY` | Set to `true` behind a load balancer so rate limits see the client IP. |
| `FUEL_PRICE_PETROL_INR` | Configurable petrol price for later cost calculations. |
| `FUEL_PRICE_DIESEL_INR` | Configurable diesel price for later cost calculations. |

## API

- Base prefix: `/api/v1`
- Health endpoint: `GET /api/v1/health`
- Swagger docs: `GET /api/docs`

API responses use a consistent envelope:

```json
{
  "success": true,
  "data": {}
}
```

Errors use:

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Validation failed"
  }
}
```

## Tests

```bash
npm test --workspace api        # unit tests, including the route-access rules
npm test --workspace web        # Angular unit tests
```

End-to-end API tests start the built API against a disposable, migrated and seeded database:

```bash
createdb travel_planner_e2e
cd apps/api
DATABASE_URL=postgresql://…/travel_planner_e2e npx prisma migrate deploy
DATABASE_URL=postgresql://…/travel_planner_e2e npm run prisma:seed
npm run build
E2E_DATABASE_URL=postgresql://…/travel_planner_e2e npm run test:e2e
```

CI (`.github/workflows/ci.yml`) runs all of the above on every pull request, and fails if `schema.prisma` changes without a matching migration.

### Access rules

Every API route requires sign-in unless it is decorated with `@Public()`. `src/route-access.spec.ts` lists the public routes explicitly, so adding one fails the tests until it is added to that list on purpose. Admin routes must also declare `@Roles(...)`.

## Verification

```bash
npm run build:web
npm run build:api
npm run db:up
curl http://localhost:3000/api/v1/health
```
