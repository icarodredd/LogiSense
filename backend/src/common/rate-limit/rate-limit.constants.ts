export const RATE_LIMIT_KEY = 'logisense:rate-limit';

export const RATE_LIMIT_MODULE_OPTIONS = 'RATE_LIMIT_MODULE_OPTIONS';

export interface RateLimitConfig {
  limit: number;
  ttlMs: number;
}
