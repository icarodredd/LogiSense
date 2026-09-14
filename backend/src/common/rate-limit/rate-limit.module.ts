import { Global, Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RATE_LIMIT_MODULE_OPTIONS, type RateLimitConfig } from './rate-limit.constants.js';
import { RateLimitGuard } from './rate-limit.guard.js';

@Global()
@Module({})
export class RateLimitModule {
  static forRoot(options: RateLimitConfig): DynamicModule {
    return {
      module: RateLimitModule,
      providers: [
        { provide: RATE_LIMIT_MODULE_OPTIONS, useValue: options },
        RateLimitGuard,
        { provide: APP_GUARD, useClass: RateLimitGuard },
      ],
      exports: [RATE_LIMIT_MODULE_OPTIONS, RateLimitGuard],
    };
  }
}
