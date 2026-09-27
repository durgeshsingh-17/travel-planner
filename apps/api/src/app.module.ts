import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { configuration } from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthGuard } from './modules/auth/auth.guard';
import { ContentModule } from './modules/content/content.module';
import { AuthModule } from './modules/auth/auth.module';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { RolesGuard } from './modules/auth/roles.guard';
import { DestinationsModule } from './modules/destinations/destinations.module';
import { HealthModule } from './modules/health/health.module';
import { LocationsModule } from './modules/locations/locations.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { MapsModule } from './modules/maps/maps.module';
import { PackagesModule } from './modules/packages/packages.module';
import { PlacesModule } from './modules/places/places.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { VerificationModule } from './modules/verification/verification.module';
import { SavedTripsModule } from './modules/saved-trips/saved-trips.module';
import { RoutingModule } from './modules/routing/routing.module';
import { TripsModule } from './modules/trips/trips.module';
import { UsersModule } from './modules/users/users.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { WeatherModule } from './modules/weather/weather.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      load: [configuration],
      validate: validateEnvironment
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: Number.parseInt(process.env.API_RATE_LIMIT_PER_MINUTE ?? '300', 10)
      }
    ]),
    DatabaseModule,
    HealthModule,
    MaintenanceModule,
    AuthModule,
    UsersModule,
    TripsModule,
    SavedTripsModule,
    LocationsModule,
    DestinationsModule,
    ContentModule,
    PackagesModule,
    VerificationModule,
    QuotesModule,
    ReviewsModule,
    AdminModule,
    PlacesModule,
    VehiclesModule,
    MapsModule,
    RoutingModule,
    WeatherModule
  ],
  providers: [
    // Order matters: rate limit, then authenticate, then authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*path');
  }
}
