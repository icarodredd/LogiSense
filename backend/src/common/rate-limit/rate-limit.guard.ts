import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AppLogger } from '../logger/app-logger.service.js';
import {
  RATE_LIMIT_KEY,
  RATE_LIMIT_MODULE_OPTIONS,
  type RateLimitConfig,
} from './rate-limit.constants.js';

interface Bucket {
  count: number;
  resetAt: number;
}

const SWEEP_INTERVAL_MS = 60_000;
const MAX_BUCKETS_BEFORE_SWEEP = 10_000;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = 0;

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RATE_LIMIT_MODULE_OPTIONS) private readonly defaults: RateLimitConfig,
    @Inject(AppLogger) private readonly logger: AppLogger,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const route =
      this.reflector.getAllAndOverride<RateLimitConfig | undefined>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    const limit = route?.limit ?? this.defaults.limit;
    const ttlMs = route?.ttlMs ?? this.defaults.ttlMs;

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const key = `${context.getClass().name}:${context.getHandler().name}:${this.tracker(req)}`;

    const now = Date.now();
    this.sweepIfDue(now);
    const bucket = this.nextBucket(key, now, ttlMs);

    const remaining = Math.max(0, limit - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil((bucket.resetAt - now) / 1000)));

    if (bucket.count > limit) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      this.logger.warn({ key, limit, ttlMs }, 'RateLimitGuard');
      throw new HttpException(
        {
          code: 'TOO_MANY_REQUESTS',
          message: `Muitas tentativas. Tente novamente em ${retryAfter}s.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private tracker(req: Request): string {
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }

  private nextBucket(key: string, now: number, ttlMs: number): Bucket {
    const current = this.buckets.get(key);
    if (current && current.resetAt > now) {
      current.count += 1;
      return current;
    }
    const fresh = { count: 1, resetAt: now + ttlMs };
    this.buckets.set(key, fresh);
    return fresh;
  }

  private sweepIfDue(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS && this.buckets.size < MAX_BUCKETS_BEFORE_SWEEP) {
      return;
    }
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
    this.lastSweep = now;
  }
}
