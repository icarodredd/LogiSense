import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_KEY, type RateLimitConfig } from './rate-limit.constants.js';

export const RateLimit = (limit: number, ttlMs: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, ttlMs } satisfies RateLimitConfig);
