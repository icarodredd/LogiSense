import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import configuration from './config/configuration.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { AppLogger } from './common/logger/app-logger.service.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { RateLimitModule } from './common/rate-limit/rate-limit.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './modules/auth/guards/roles.guard.js';
import { CarriersModule } from './modules/carriers/carriers.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { FreightModule } from './modules/freight/freight.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { InsightsModule } from './modules/insights/insights.module.js';
import { SimulationsModule } from './modules/simulations/simulations.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { ImportsModule } from './modules/imports/imports.module.js';
import { IntegrationsModule } from './modules/integrations/integrations.module.js';
import { QueueModule } from './queue/queue.module.js';
import { WebSocketModule } from './websocket/websocket.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    RateLimitModule.forRoot({ limit: 120, ttlMs: 60_000 }),
    DatabaseModule,
    QueueModule,
    AuditModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    CarriersModule,
    FreightModule,
    SimulationsModule,
    DashboardModule,
    InsightsModule,
    HealthModule,
    ImportsModule,
    IntegrationsModule,
    WebSocketModule,
  ],
  providers: [
    AppLogger,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('{*path}');
  }
}
