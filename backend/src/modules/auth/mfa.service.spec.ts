import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { generateTotpToken, MfaService } from './mfa.service.js';

function buildService() {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    },
  };
  const config = {
    get: vi.fn().mockReturnValue('test-mfa-encryption-key'),
  };
  const service = new MfaService(
    prisma as never,
    config as unknown as ConfigService,
  );
  return { service, prisma };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'admin@acme.com',
    mfaEnabled: false,
    mfaSecret: null,
    ...overrides,
  };
}

describe('MfaService — criptografia em repouso', () => {
  it('beginSetup persiste o segredo cifrado (nunca texto puro)', async () => {
    const { service, prisma } = buildService();
    const setup = await service.beginSetup(makeUser());
    const stored = prisma.user.update.mock.calls[0][0].data.mfaSecret as string;
    expect(stored).not.toContain(setup.secret);
    expect(stored).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(setup.qrCodeDataUri).toMatch(/^data:image\/png;base64,/);
    expect(setup.otpauthUri).toContain('otpauth://totp/');
  });

  it('beginSetup recusa quando MFA já está ativo', async () => {
    const { service } = buildService();
    await expect(
      service.beginSetup(makeUser({ mfaEnabled: true })),
    ).rejects.toThrowError(BadRequestException);
  });

  it('segredo cifrado não revela o texto nem com outra chave', async () => {
    const { service, prisma } = buildService();
    const otherConfig = { get: vi.fn().mockReturnValue('outra-chave') };
    const other = new MfaService(
      { user: { update: vi.fn() } } as never,
      otherConfig as unknown as ConfigService,
    );
    const setup = await service.beginSetup(makeUser());
    const stored = prisma.user.update.mock.calls[0][0].data.mfaSecret as string;
    // Mesma chave decifra; chave errada retorna null (GCM auth tag falha).
    expect(service.decryptSecret(stored)).toBe(setup.secret);
    expect(other.decryptSecret(stored)).toBeNull();
  });
});

describe('MfaService — confirmação e ativação', () => {
  it('confirmSetup ativa o MFA com código TOTP válido', async () => {
    const { service, prisma } = buildService();
    const setup = await service.beginSetup(makeUser());
    const stored = prisma.user.update.mock.calls[0][0].data.mfaSecret as string;
    const token = generateTotpToken(setup.secret);
    const result = await service.confirmSetup(
      makeUser({ mfaSecret: stored }),
      token,
    );
    expect(result).toEqual({ mfaEnabled: true });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { mfaEnabled: true } }),
    );
  });

  it('confirmSetup rejeita código inválido sem ativar', async () => {
    const { service, prisma } = buildService();
    await service.beginSetup(makeUser());
    const stored = prisma.user.update.mock.calls[0][0].data.mfaSecret as string;
    await expect(
      service.confirmSetup(makeUser({ mfaSecret: stored }), '000000'),
    ).rejects.toThrowError(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { mfaEnabled: true } }),
    );
  });

  it('confirmSetup sem setup pendente acusa MFA_SETUP_NOT_FOUND', async () => {
    const { service } = buildService();
    await expect(
      service.confirmSetup(makeUser({ mfaSecret: null }), '123456'),
    ).rejects.toThrowError(
      expect.objectContaining({
        response: expect.objectContaining({ code: 'MFA_SETUP_NOT_FOUND' }),
      }),
    );
  });
});

describe('MfaService — verificação no login', () => {
  it('conta sem MFA passa sem código', () => {
    const { service } = buildService();
    expect(
      service.verifyLoginTotp(makeUser({ mfaEnabled: false }), undefined),
    ).toBe(true);
  });

  it('conta com MFA exige código válido', () => {
    const { service, prisma } = buildService();
    // Usuário com segredo cifrado: gerar código correto a partir do texto.
    return service
      .beginSetup(makeUser())
      .then(async (setup) => {
        const stored = prisma.user.update.mock.calls[0][0].data.mfaSecret as string;
        const user = makeUser({ mfaEnabled: true, mfaSecret: stored });
        const good = generateTotpToken(setup.secret);
        expect(service.verifyLoginTotp(user, good)).toBe(true);
        expect(service.verifyLoginTotp(user, '000000')).toBe(false);
        expect(service.verifyLoginTotp(user, undefined)).toBe(false);
      });
  });

  it('segredo corrompido não autentica (fail-closed)', async () => {
    const { service } = buildService();
    const user = makeUser({ mfaEnabled: true, mfaSecret: 'lixo' });
    expect(service.verifyLoginTotp(user, '123456')).toBe(false);
  });
});

describe('MfaService — desativação', () => {
  it('disable exige TOTP válido e limpa o segredo', async () => {
    const { service, prisma } = buildService();
    const setup = await service.beginSetup(makeUser());
    const stored = prisma.user.update.mock.calls[0][0].data.mfaSecret as string;
    const token = generateTotpToken(setup.secret);
    const result = await service.disable(
      makeUser({ mfaEnabled: true, mfaSecret: stored }),
      token,
    );
    expect(result).toEqual({ mfaEnabled: false });
    expect(prisma.user.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { mfaEnabled: false, mfaSecret: null },
      }),
    );
  });

  it('disable com código errado retorna INVALID_TOTP', async () => {
    const { service, prisma } = buildService();
    await service.beginSetup(makeUser());
    const stored = prisma.user.update.mock.calls[0][0].data.mfaSecret as string;
    await expect(
      service.disable(makeUser({ mfaEnabled: true, mfaSecret: stored }), '000000'),
    ).rejects.toThrowError(UnauthorizedException);
  });

  it('disable em conta sem MFA acusa MFA_NOT_ENABLED', async () => {
    const { service } = buildService();
    await expect(
      service.disable(makeUser({ mfaEnabled: false }), '123456'),
    ).rejects.toThrowError(BadRequestException);
  });
});
