import { describe, expect, it, vi } from 'vitest';
import { WsAuthService } from './ws-auth.service.js';

function client(cookie?: string) {
  return {
    handshake: { auth: {}, headers: cookie ? { cookie } : {} },
    data: {},
  };
}

describe('WsAuthService', () => {
  it('extrai o access token do cookie HttpOnly da sessão web', () => {
    const service = new WsAuthService(
      {} as never,
      {} as never,
      {} as never,
    );

    expect(service.extractToken(client('theme=dark; ls_access=token%2Bvalue; foo=bar') as never)).toBe(
      'token+value',
    );
  });

  it('prioriza token explícito do handshake sobre cookie', () => {
    const socket = client('ls_access=cookie-token');
    socket.handshake.auth = { token: 'handshake-token' };
    const service = new WsAuthService(
      {} as never,
      {} as never,
      {} as never,
    );

    expect(service.extractToken(socket as never)).toBe('handshake-token');
  });

  it('autentica o usuário ativo pertencente ao tenant do JWT', async () => {
    const verifyAsync = vi.fn().mockResolvedValue({
      sub: 'user-1',
      tenantId: 'tenant-1',
      email: 'user@example.com',
      role: 'OPERATOR',
    });
    const findUnique = vi.fn().mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'user@example.com',
      role: 'OPERATOR',
      status: 'ACTIVE',
    });
    const service = new WsAuthService(
      { verifyAsync } as never,
      { get: vi.fn().mockReturnValue('secret') } as never,
      { user: { findUnique } } as never,
    );

    await expect(service.authenticate(client('ls_access=jwt-token') as never)).resolves.toMatchObject({
      id: 'user-1',
      tenantId: 'tenant-1',
    });
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1' },
    }));
  });
});
