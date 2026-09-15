import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AppLogger } from './common/logger/app-logger.service.js';
import { SocketIoAdapter } from './websocket/socket-io.adapter.js';

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

  app.useWebSocketAdapter(new SocketIoAdapter(app, configService));

  await app.listen(port);
  logger.log(`LogiSense API listening on :${port} (prefix /api)`, 'Bootstrap');
}

await bootstrap().catch((error: unknown) => {
  if (
    error instanceof Error &&
    'code' in error &&
    error.code === 'EADDRINUSE'
  ) {
    console.error(
      'A porta da API já está em uso. Encerre a instância existente ou defina outra porta via PORT antes de iniciar o backend.',
    );
  } else {
    console.error('Falha ao iniciar a API:', error);
  }
  process.exit(1);
});
