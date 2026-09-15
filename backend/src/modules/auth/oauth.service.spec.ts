import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../config/configuration.js';
import { OAuthService } from './oauth.service.js';

const oauthConfig: AppConfig['oauth'] = {
  google: {
    clientId: 'google-id',
    clientSecret: 'google-secret',
    callbackUrl: 'http://localhost:3001/api/auth/google/callback',
  },
  github: {
    clientId: 'github-id',
    clientSecret: 'github-secret',
    callbackUrl: 'http://localhost:3001/api/auth/github/callback',
  },
};

function buildService() {
  const prisma = {
    oAuthAccount: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };
  const config = new ConfigService({ oauth: oauthConfig });
  const service = new OAuthService(prisma as never, config as never);
  return { service, prisma };
}

const googleProfile = {
  provider: 'GOOGLE' as const,
  providerAccountId: 'g-123',
  email: 'user@acme.com',
  name: 'User Google',
};

describe('OAuthService — authorize URL', () => {
  it('gera URL do Google com state e redirect_uri corretos', () => {
    const { service } = buildService();
    const url = new URL(
      service.buildAuthorizeUrl('google', 'state-abc'),
    );
    expect(url.origin + url.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(url.searchParams.get('client_id')).toBe('google-id');
    expect(url.searchParams.get('state')).toBe('state-abc');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3001/api/auth/google/callback',
    );
  });

  it('gera URL do GitHub com escopo de e-mail', () => {
    const { service } = buildService();
    const url = new URL(service.buildAuthorizeUrl('github', 'st'));
    expect(url.origin + url.pathname).toBe(
      'https://github.com/login/oauth/authorize',
    );
    expect(url.searchParams.get('scope')).toBe('read:user user:email');
  });

  it('detecta provedor não configurado', () => {
    const { service } = buildService();
    expect(service.isProviderConfigured('google')).toBe(true);
    const emptyConfig = new ConfigService({
      oauth: {
        ...oauthConfig,
        google: { clientId: '', clientSecret: '', callbackUrl: '' },
      },
    });
    const empty = new OAuthService(
      { oAuthAccount: {}, user: {}, tenant: {} } as never,
      emptyConfig as never,
    );
    expect(empty.isProviderConfigured('google')).toBe(false);
  });
});

describe('OAuthService — resolveUser (vinculação de contas)', () => {
  it('retorna usuário quando a conta OAuth já está vinculada', async () => {
    const { service, prisma } = buildService();
    const existing = { id: 'u1', tenantId: 't1', email: 'user@acme.com' };
    prisma.oAuthAccount.findUnique.mockResolvedValue({
      user: existing,
    });
    const result = await service.resolveUser(googleProfile);
    expect(result.user).toEqual(existing);
    expect(result.linked).toBe(true);
    expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
  });

  it('vincula ao usuário existente com mesmo e-mail', async () => {
    const { service, prisma } = buildService();
    prisma.oAuthAccount.findUnique.mockResolvedValue(null);
    prisma.user.findMany.mockResolvedValue([
      { id: 'u-other-tenant', tenantId: 't2', email: 'user@acme.com' },
      { id: 'u-target', tenantId: 't1', email: 'user@acme.com' },
    ]);
    const result = await service.resolveUser(googleProfile);
    expect(result.user.id).toBe('u-other-tenant');
    expect(prisma.oAuthAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'u-other-tenant' }),
      }),
    );
  });

  it('cria tenant e usuário ADMIN no primeiro acesso', async () => {
    const { service, prisma } = buildService();
    prisma.oAuthAccount.findUnique.mockResolvedValue(null);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.tenant.findUnique.mockResolvedValue(null);
    prisma.tenant.create.mockResolvedValue({ id: 'new-tenant', name: 'User Google', slug: 'user-google' });
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({
        ...data,
        id: 'new-user',
        oauthAccounts: undefined,
      }),
    );
    const result = await service.resolveUser(googleProfile);
    expect(result.created).toBe(true);
    expect(prisma.tenant.create).toHaveBeenCalledWith({
      data: { name: 'User Google', slug: 'user-google' },
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'new-tenant', role: 'ADMIN' }),
      }),
    );
  });
});
