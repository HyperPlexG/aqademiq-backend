import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'node:fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // §6: app is /v1 from first deploy.
  app.setGlobalPrefix('v1');

  // Flutter web target needs CORS; native mobile ignores it. Safe to enable.
  app.enableCors({ origin: true });

  // §6 / §3: wire contract is snake_case. The Flutter DTOs (task_dto.dart,
  // subject_dto.dart) are the authoritative shapes. NestJS defaults to
  // camelCase, so DTO properties are written snake_case directly and we
  // validate strictly — contract tests should diff against the Dart DTOs.
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true,
  }));

  // OpenAPI contract for the Flutter handoff (backend_contract/openapi.json).
  // Served at /docs (Swagger UI) and /docs-json (the spec the client gen reads).
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Aqademiq API')
    .setDescription('NestJS backend — /v1, snake_case. Auth: custom RS256 JWT (Bearer).')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);
  // Emit the spec to disk on boot when asked (EMIT_OPENAPI=1) — used to refresh
  // the handoff contract without scraping the running server.
  if (process.env.EMIT_OPENAPI === '1') {
    fs.writeFileSync('openapi.json', JSON.stringify(document, null, 2));
  }

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 8080);
}
bootstrap();
