import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RateLimitGuard } from './rate-limit.guard.js';

function setup(route: { limit: number; ttlMs: number } | undefined, ip = '10.0.0.1') {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(route) };
  const logger = { warn: vi.fn(), log: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const guard = new RateLimitGuard(
    reflector as never,
    { limit: 120, ttlMs: 60_000 },
    logger as never,
  );
  const headers: Record<string, string> = {};
  const ctx = {
    getHandler: () => ({ name: 'login' }),
    getClass: () => ({ name: 'AuthController' }),
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
      getResponse: () => ({ setHeader: (k: string, v: string) => (headers[k] = v) }),
    }),
  } as never;
  return { guard, ctx, headers };
}

describe('RateLimitGuard', () => {
  it('libera requisições dentro do limite da rota', () => {
    const { guard, ctx } = setup({ limit: 2, ttlMs: 60_000 });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('bloqueia com 429 ao exceder o limite e informa Retry-After', () => {
    const { guard, ctx, headers } = setup({ limit: 2, ttlMs: 60_000 });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
    try {
      guard.canActivate(ctx);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: 'TOO_MANY_REQUESTS',
      });
      expect(headers['Retry-After']).toBeDefined();
      expect(headers['X-RateLimit-Remaining']).toBe('0');
    }
  });

  it('usa o limite padrão quando a rota não declara @RateLimit', () => {
    const { guard, ctx, headers } = setup(undefined);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(headers['X-RateLimit-Limit']).toBe('120');
  });

  it('isola contadores por IP', () => {
    const first = setup({ limit: 1, ttlMs: 60_000 }, '10.0.0.1');
    const second = setup({ limit: 1, ttlMs: 60_000 }, '10.0.0.2');
    const guard = first.guard;
    expect(guard.canActivate(first.ctx)).toBe(true);
    expect(guard.canActivate(second.ctx)).toBe(true);
    expect(() => guard.canActivate(first.ctx)).toThrowError(HttpException);
  });
});
