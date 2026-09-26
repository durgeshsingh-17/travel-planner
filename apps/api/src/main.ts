import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  if (config.get<string>('TRUST_PROXY')) {
    // Needed behind a load balancer so rate limits apply per client, not per proxy.
    app.set('trust proxy', config.get<string>('TRUST_PROXY') === 'true' ? 1 : config.get<string>('TRUST_PROXY'));
  }

  app.use(helmet());
  app.enableCors({
    origin: config.get<string>('API_CORS_ORIGIN', 'http://localhost:4200'),
    credentials: true,
    exposedHeaders: ['x-request-id']
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1'
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true
      }
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Travel Platform API')
    .setDescription('India-first travel and road-trip planning REST API.')
    .setVersion('1.0')
    .addTag('health')
    .addTag('auth')
    .addTag('me')
    .addTag('trips')
    .addTag('saved-trips')
    .addTag('locations')
    .addTag('destinations')
    .addTag('places')
    .addTag('vehicles')
    .addTag('maps')
    .addTag('weather')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('API_PORT', 3000);
  await app.listen(port, config.get<string>('API_HOST', '127.0.0.1'));
}

bootstrap();
