import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OAuthProvider, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type { AppConfig } from '../../config/configuration.js';

export interface OAuthProfile {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  name: string;
}

export interface ResolvedOAuthUser {
  user: User;
  created: boolean;
  linked: boolean;
}

interface GoogleTokenResponse {
  access_token: string;
}
interface GoogleProfileResponse {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}
interface GitHubTokenResponse {
  access_token: string;
}
interface GitHubProfileResponse {
  id: number;
  login: string;
  name?: string | null;
  emails?: { email: string; primary: boolean; verified: boolean }[];
}

export type OAuthProviderName = 'google' | 'github';

/**
 * OAuth Google/GitHub com fluxo Authorization Code (AGENTS.md §16).
 *
 * Encapsulado no backend: o frontend só recebe o redirect para o provedor
 * e o callback cuida do restante. Nenhum secret trafega ao browser.
 *
 * Vinculação de contas (oauth_accounts): se o e-mail do provedor já existe
 * em um único tenant, vincula; se não existe, cria usuário OPERATOR em um
 * tenant específico (via state) — o tenantId SEMPRE deriva do usuário,
 * nunca do cliente.
 */
@Injectable()
export class OAuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private providerConfig(name: OAuthProviderName) {
    const oauth = this.config.get('oauth', { infer: true });
    return name === 'google' ? oauth.google : oauth.github;
  }

  isProviderConfigured(name: OAuthProviderName): boolean {
    const cfg = this.providerConfig(name);
    return Boolean(cfg.clientId && cfg.clientSecret);
  }

  /** URL de autorização para iniciar o fluxo no provedor. */
  buildAuthorizeUrl(name: OAuthProviderName, state: string): string {
    const cfg = this.providerConfig(name);
    const redirectUri = new URL(cfg.callbackUrl).toString();
    if (name === 'google') {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id', cfg.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('state', state);
      url.searchParams.set('access_type', 'online');
      return url.toString();
    }
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', cfg.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'read:user user:email');
    url.searchParams.set('state', state);
    return url.toString();
  }

  /** Troca o code pelo perfil do usuário no provedor. */
  async exchangeCodeForProfile(
    name: OAuthProviderName,
    code: string,
  ): Promise<OAuthProfile> {
    const cfg = this.providerConfig(name);
    if (name === 'google') {
      const token = await this.fetchJson<GoogleTokenResponse>(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: cfg.clientId,
            client_secret: cfg.clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: cfg.callbackUrl,
          }),
        },
      );
      const profile = await this.fetchJson<GoogleProfileResponse>(
        'https://openidconnect.googleapis.com/v1/userinfo',
        { headers: { authorization: `Bearer ${token.access_token}` } },
      );
      if (!profile.email || profile.email_verified === false) {
        throw new UnauthorizedException({
          code: 'OAUTH_EMAIL_UNAVAILABLE',
          message: 'O provedor não retornou um e-mail verificado.',
        });
      }
      return {
        provider: 'GOOGLE',
        providerAccountId: profile.sub,
        email: profile.email.toLowerCase(),
        name: profile.name ?? profile.email,
      };
    }

    const token = await this.fetchJson<GitHubTokenResponse>(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          code,
          redirect_uri: cfg.callbackUrl,
        }),
      },
    );
    const headers = {
      authorization: `Bearer ${token.access_token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'LogiSense',
    };
    const profile = await this.fetchJson<GitHubProfileResponse>(
      'https://api.github.com/user',
      { headers },
    );
    let email = profile.emails?.find((e) => e.primary && e.verified)?.email;
    if (!email) {
      // user:email pode exigir chamada dedicada quando o e-mail é privado.
      const emails = await this.fetchJson<GitHubProfileResponse['emails']>(
        'https://api.github.com/user/emails',
        { headers },
      );
      email = emails?.find((e) => e.primary && e.verified)?.email;
    }
    if (!email) {
      throw new UnauthorizedException({
        code: 'OAUTH_EMAIL_UNAVAILABLE',
        message: 'Não foi possível obter um e-mail verificado do GitHub.',
      });
    }
    return {
      provider: 'GITHUB',
      providerAccountId: String(profile.id),
      email: email.toLowerCase(),
      name: profile.name ?? profile.login,
    };
  }

  /**
   * Resolve o usuário local a partir do perfil OAuth:
   * 1. conta oauth já vinculada -> retorna usuário;
   * 2. e-mail já existe -> vincula a conta OAuth ao usuário existente;
   * 3. não existe -> cria usuário OPERATOR no tenant do state (invite/link).
   */
  async resolveUser(
    profile: OAuthProfile,
    tenantHint?: string,
  ): Promise<ResolvedOAuthUser> {
    // 1. Conta já vinculada?
    const linked = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });
    if (linked) return { user: linked.user, created: false, linked: true };

    // 2. E-mail já existe (podem ser múltiplos tenants) — sem tenantHint,
    //    ambiguidade não decide tenant: exige hint ou falha.
    const byEmail = await this.prisma.user.findMany({
      where: { email: profile.email },
      orderBy: { createdAt: 'asc' },
    });
    const target = tenantHint
      ? byEmail.find((u) => u.tenantId === tenantHint)
      : (byEmail[0] ?? null);
    if (target) {
      await this.prisma.oAuthAccount.create({
        data: {
          userId: target.id,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      });
      return { user: target, created: false, linked: true };
    }

    // 3. Sem usuário e sem tenant válido para cadastro -> erro controlado.
    if (!tenantHint) {
      throw new UnauthorizedException({
        code: 'OAUTH_NO_ACCOUNT',
        message:
          'Nenhuma conta encontrada para este e-mail. Faça login com senha primeiro para vincular.',
      });
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantHint },
    });
    if (!tenant) {
      throw new UnauthorizedException({
        code: 'OAUTH_INVALID_TENANT',
        message: 'Tenant inválido para cadastro via OAuth.',
      });
    }
    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: profile.name,
        email: profile.email,
        role: 'OPERATOR',
        oauthAccounts: {
          create: {
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
          },
        },
      },
    });
    return { user, created: true, linked: false };
  }

  private async fetchJson<T>(
    url: string,
    init: RequestInit,
  ): Promise<T> {
    const res = await fetch(url, init);
    if (!res.ok) {
      throw new UnauthorizedException({
        code: 'OAUTH_PROVIDER_ERROR',
        message: 'Falha na comunicação com o provedor OAuth.',
      });
    }
    return (await res.json()) as T;
  }
}
