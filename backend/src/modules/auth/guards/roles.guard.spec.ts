import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RolesGuard } from './roles.guard.js';

function contextWith(user: unknown, roles: string[] | undefined) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(roles),
  };
  const guard = new RolesGuard(reflector as never);
  const ctx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
  return guard.canActivate(ctx as never);
}

describe('RolesGuard', () => {
  it('libera quando a rota não exige perfil', () => {
    expect(contextWith({ role: 'OPERATOR' }, undefined)).toBe(true);
    expect(contextWith({ role: 'OPERATOR' }, [])).toBe(true);
  });

  it('libera quando o perfil está entre os exigidos', () => {
    expect(contextWith({ role: 'MANAGER' }, ['ADMIN', 'MANAGER'])).toBe(true);
  });

  it('nega com FORBIDDEN quando o perfil não basta', () => {
    try {
      contextWith({ role: 'OPERATOR' }, ['ADMIN']);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'FORBIDDEN',
      });
    }
  });

  it('nega quando não há usuário autenticado', () => {
    expect(() =>
      contextWith(undefined, ['ADMIN']),
    ).toThrowError(ForbiddenException);
  });
});
