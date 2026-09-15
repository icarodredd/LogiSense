import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import type { AppConfig } from '../../config/configuration.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RedisService } from '../../database/redis.service.js';
import { extractAuditContext } from '../audit/audit-context.js';
import { AuditAction } from '../audit/audit-action.js';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from './auth.service.js';
import { OAuthService, type OAuthProviderName } from './oauth.service.js';
import { TokenService } from './token.service.js';

const STATE_TTL_SECONDS = 300;

function isProvider(value: string): value is OAuthProviderName {
  return value === 'google' || value === 'github';
}

/**
 * Fluxo OAuth Authorization Code (AGENTS.md §16):
 *
 * GET /auth/:provider/authorize  -> redirect ao provedor (state anti-CSRF no Redis)
 * GET /auth/:provider/callback   -> valida state, troca code, resolve usuário,
 *                                    cria sessão e redireciona ao frontend.
 *
 * O `state` carrega o tenantHint quando o usuário já autenticado opta por
 * vincular a conta — nunca confiamos em tenantId do body/query para dados.
 */
@Public()
@Controller('auth')
export class OAuthController {
  constructor(
    @Inject(OAuthService) private readonly oauth: OAuthService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ConfigService) private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Get(':provider/authorize')
  async authorize(
    @Param('provider') provider: string,
    @Res() res: Response,
  ) {
    if (!isProvider(provider)) {
      throw new UnauthorizedException({
        code: 'OAUTH_UNSUPPORTED_PROVIDER',
        message: 'Provedor OAuth não suportado.',
      });
    }
    if (!this.oauth.isProviderConfigured(provider)) {
      throw new UnauthorizedException({
        code: 'OAUTH_NOT_CONFIGURED',
        message: `OAuth ${provider} não está configurado no servidor.`,
      });
    }
    const state = randomBytes(24).toString('hex');
    const payload = JSON.stringify({ flow: 'login_or_signup' });
    await this.redis.getClient().set(
      `oauth:state:${state}`,
      payload,
      'EX',
      STATE_TTL_SECONDS,
    );
    return res.redirect(this.oauth.buildAuthorizeUrl(provider, state));
  }

  @Get(':provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!isProvider(provider)) {
      throw new UnauthorizedException({
        code: 'OAUTH_UNSUPPORTED_PROVIDER',
        message: 'Provedor OAuth não suportado.',
      });
    }
    if (!code || !state) {
      throw new UnauthorizedException({
        code: 'OAUTH_INVALID_CALLBACK',
        message: 'Callback OAuth inválido.',
      });
    }
    // Valida e consome o state (anti-CSRF, one-time use).
    const stateKey = `oauth:state:${state}`;
    const raw = await this.redis.getClient().get(stateKey);
    if (!raw) {
      throw new UnauthorizedException({
        code: 'OAUTH_INVALID_STATE',
        message: 'Sessão de autorização expirada. Tente novamente.',
      });
    }
    await this.redis.getClient().del(stateKey);
    JSON.parse(raw) as { flow: string };

    const profile = await this.oauth.exchangeCodeForProfile(provider, code);
    const resolved = await this.oauth.resolveUser(profile);
    if (resolved.user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Conta suspensa. Fale com o administrador.',
      });
    }

    const session = await this.tokens.createSession(resolved.user);
    this.auth.setAuthCookies(res, session);
    await this.audit.log({
      ...extractAuditContext(req),
      tenantId: resolved.user.tenantId,
      userId: resolved.user.id,
      action: resolved.linked
        ? AuditAction.OAUTH_ACCOUNT_LINKED
        : AuditAction.OAUTH_LOGIN,
      entity: 'User',
      entityId: resolved.user.id,
      metadata: { provider: profile.provider },
    });
    const frontendUrl = this.config.get('frontendUrl', { infer: true });
    return res.redirect(`${frontendUrl}/dashboard`);
  }
}
