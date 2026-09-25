# Travel Platform Architecture

The MVP is a modular monorepo with an Angular frontend, a NestJS REST API, and PostgreSQL with PostGIS-ready storage.

## Applications

- `apps/web`: Angular standalone frontend.
- `apps/api`: NestJS modular monolith API.

## Principles

- Keep itinerary data structured as trips, days, and activities.
- Keep cost calculations deterministic and out of UI components.
- Use REST contracts that can later be backed by AI itinerary providers without changing the frontend shape.
- Keep Redis, bookings, RAG, recommendations, and microservices out of the MVP until the core product flow is stable.
