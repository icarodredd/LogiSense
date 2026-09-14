import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const SECRET = 'test-secret';

function setup(overrides: {
  isPublic?: boolean;
  cookies?: Record<string, string>;
  authHeader?: string;
  verify?: unknown;
  dbUser?: unknown;
} = {}) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(overrides.isPublic ?? false),
  };
  const jwt = {
    verifyAsync: overrides.verify instanceof Error
      ? vi.fn().mockRejectedValue(overrides.verify)
      : vi.fn().mockResolvedValue(
          overrides.verify ?? {
            sub: 'user-1',
            tenantId: 'tenant-1',
            email: 'a@a.com',
            role: 'ADMIN',
          },
        ),
  };
  const config = { get: vi.fn().mockReturnValue(SECRET) };
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(overrides.dbUser ?? {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'a@a.com',
      role: 'ADMIN',
      status: 'ACTIVE',
    }) },
  };
  const guard = new JwtAuthGuard(reflector as never, jwt as never, config as never, prisma as never);

  const req: Record<string, unknown> = {
    cookies: overrides.cookies ?? {},
    headers: overrides.authHeader ? { authorization: overrides.authHeader } : {},
  };
  const ctx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as never;
  return { guard, ctx, req, jwt, prisma };
}

describe('JwtAuthGuard', () => {
  it('libera rotas @Public sem validar token', async () => {
    const { guard, ctx } = setup({ isPublic: true });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejeita sem token com UNAUTHENTICATED', async () => {
    const { guard, ctx } = setup();
    const error = await guard.canActivate(ctx).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).getResponse()).toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('aceita token via cookie e anexa o usuário do tenant do token', async () => {
    const { guard, ctx, req } = setup({ cookies: { ls_access: 'valid' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req).toMatchObject({
      user: { id: 'user-1', tenantId: 'tenant-1', role: 'ADMIN' },
    });
  });

  it('aceita token via header Bearer', async () => {
    const { guard, ctx, req } = setup({ authHeader: 'Bearer valid' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req).toHaveProperty('user');
  });

  it('rejeita token inválido com INVALID_TOKEN', async () => {
    const { guard, ctx } = setup({
      cookies: { ls_access: 'bad' },
      verify: new Error('jwt malformed'),
    });
    const error = await guard.canActivate(ctx).catch((e: unknown) => e);
    expect((error as UnauthorizedException).getResponse()).toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });

  it('rejeita quando o tenant do token diverge do usuário (isolamento)', async () => {
    const { guard, ctx } = setup({
      cookies: { ls_access: 'valid' },
      dbUser: {
        id: 'user-1',
        tenantId: 'tenant-OUTRO',
        email: 'a@a.com',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    const error = await guard.canActivate(ctx).catch((e: unknown) => e);
    expect((error as UnauthorizedException).getResponse()).toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });

  it('rejeita conta suspensa com ACCOUNT_SUSPENDED', async () => {
    const { guard, ctx } = setup({
      cookies: { ls_access: 'valid' },
      dbUser: {
        id: 'user-1',
        tenantId: 'tenant-1',
        email: 'a@a.com',
        role: 'ADMIN',
        status: 'SUSPENDED',
      },
    });
    const error = await guard.canActivate(ctx).catch((e: unknown) => e);
    expect((error as UnauthorizedException).getResponse()).toMatchObject({
      code: 'ACCOUNT_SUSPENDED',
    });
  });
});
