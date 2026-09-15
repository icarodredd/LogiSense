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
  access_token?: string;
  error?: string;
  error_description?: string;
}
interface GitHubProfileResponse {
  id: number;
  login: string;
  name?: string | null;
  emails?: { email: string; primary: boolean; verified: boolean }[];
}

export type OAuthProviderName = 'google' | 'github';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'workspace';
}

/**
 * OAuth Google/GitHub com fluxo Authorization Code (AGENTS.md §16).
 *
 * Encapsulado no backend: o frontend só recebe o redirect para o provedor
 * e o callback cuida do restante. Nenhum secret trafega ao browser.
 *
 * Vinculação de contas (oauth_accounts): se o e-mail do provedor já existe
 * em um tenant, vincula; se não existe, cria um tenant novo e o primeiro
 * usuário como ADMIN.
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
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
          'user-agent': 'LogiSense',
        },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          code,
          redirect_uri: cfg.callbackUrl,
        }),
      },
    );
    if (!token.access_token) {
      throw new UnauthorizedException({
        code: 'OAUTH_PROVIDER_ERROR',
        message: 'O GitHub não autorizou a troca do código OAuth.',
      });
    }
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
   * 3. não existe -> cria um tenant novo e seu primeiro usuário ADMIN.
   */
  async resolveUser(
    profile: OAuthProfile,
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

    // 2. E-mail já existe: vincula automaticamente à primeira conta local.
    const byEmail = await this.prisma.user.findMany({
      where: { email: profile.email },
      orderBy: { createdAt: 'asc' },
    });
    const target = byEmail[0] ?? null;
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

    // 3. Primeiro acesso: cria um tenant próprio, sem aceitar tenantId externo.
    const baseSlug = slugify(profile.name);
    let slug = baseSlug;
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      const taken = await this.prisma.tenant.findUnique({ where: { slug } });
      if (!taken) break;
      slug = `${baseSlug}-${attempt + 1}`;
    }
    const tenant = await this.prisma.tenant.create({
      data: { name: profile.name.trim(), slug },
    });
    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: profile.name,
        email: profile.email,
        role: 'ADMIN',
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
      const providerUrl = new URL(url);
      const provider = `${providerUrl.hostname}${providerUrl.pathname}`;
      const responseBody = await res.text();
      let providerMessage: string | undefined;
      try {
        const parsed = JSON.parse(responseBody) as { message?: unknown };
        providerMessage =
          typeof parsed.message === 'string' ? parsed.message : undefined;
      } catch {
        providerMessage = undefined;
      }
      throw new UnauthorizedException({
        code: 'OAUTH_PROVIDER_ERROR',
        message: `O provedor OAuth recusou a requisição (${provider}, HTTP ${res.status}${providerMessage ? `: ${providerMessage}` : ''}).`,
      });
    }
    return (await res.json()) as T;
  }
}
