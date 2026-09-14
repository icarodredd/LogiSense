import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AppLogger } from './common/logger/app-logger.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(AppLogger);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', { infer: true }) ?? 3001;
  const corsOrigins =
    configService.get<string[]>('corsOrigins', { infer: true }) ?? [];

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port);
  logger.log(`LogiSense API listening on :${port} (prefix /api)`, 'Bootstrap');
}

await bootstrap();
