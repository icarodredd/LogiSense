import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditAction } from '../audit/audit-action.js';
import { AuditService, type AuditContext } from '../audit/audit.service.js';
import { toUserResponse } from '../users/user.presenter.js';
import { UsersService } from '../users/users.service.js';
import { LoginDto, RegisterDto } from './auth.dto.js';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './guards/jwt-auth.guard.js';
import { MfaService } from './mfa.service.js';
import { TokenService, type SessionTokens, parseDurationToMs } from './token.service.js';
import { ConfigService } from '@nestjs/config';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MfaService) private readonly mfa: MfaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  setAuthCookies(res: Response, session: SessionTokens): void {
    const secure = this.config.get<boolean>('cookieSecure', { infer: true }) ?? false;
    const accessMaxAge = Math.min(
      parseDurationToMs(
        this.config.get<string>('jwt.accessExpiresIn', { infer: true }) ?? '15m',
      ),
      2147483647,
    );
    const refreshMaxAge = Math.min(
      parseDurationToMs(
        this.config.get<string>('jwt.refreshExpiresIn', { infer: true }) ?? '7d',
      ),
      2147483647,
    );
    res.cookie(ACCESS_COOKIE, session.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: accessMaxAge,
    });
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: refreshMaxAge,
    });
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  }

  /** Registro público: cria um tenant novo + o primeiro usuário como ADMIN. */
  async register(dto: RegisterDto, auditCtx: AuditContext) {
    const email = dto.email.toLowerCase().trim();
    const baseSlug = slugify(dto.tenantName) || 'empresa';
    let slug = baseSlug;
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      const taken = await this.prisma.tenant.findUnique({ where: { slug } });
      if (!taken) break;
      slug = `${baseSlug}-${attempt + 1}`;
    }

    const tenant = await this.prisma.tenant.create({
      data: { name: dto.tenantName.trim(), slug },
    });
    try {
      const user = await this.prisma.user.create({
        data: {
          tenantId: tenant.id,
          name: dto.name.trim(),
          email,
          passwordHash: await this.users.hashPassword(dto.password),
          role: 'ADMIN',
        },
      });
      const session = await this.tokens.createSession(user);
      await this.audit.log({
        ...auditCtx,
        tenantId: tenant.id,
        userId: user.id,
        action: AuditAction.TENANT_CREATED,
        entity: 'Tenant',
        entityId: tenant.id,
        metadata: { slug: tenant.slug },
      });
      await this.audit.log({
        ...auditCtx,
        tenantId: tenant.id,
        userId: user.id,
        action: AuditAction.LOGIN,
        entity: 'User',
        entityId: user.id,
        metadata: { method: 'register' },
      });
      return { user: toUserResponse(user), tenant, session };
    } catch (error) {
      // Email duplicado dentro do tenant recém-criado é improvável aqui
      // (tenant novo), mas tratamos para não vazar erro interno.
      await this.prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => undefined);
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'EMAIL_TAKEN',
          message: 'Este e-mail já está em uso.',
        });
      }
      throw error;
    }
  }

  async login(dto: LoginDto, auditCtx: AuditContext) {
    // E-mails são únicos por tenant, mas podem se repetir entre tenants.
    // Testa a senha em cada candidato (mais antigos primeiro) e autentica
    // no tenant cuja credencial confere — o tenantId deriva do usuário.
    const email = dto.email.toLowerCase().trim();
    const candidates = await this.prisma.user.findMany({
      where: { email },
      orderBy: { createdAt: 'asc' },
    });
    let user: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (
        candidate.passwordHash &&
        (await bcrypt.compare(dto.password, candidate.passwordHash))
      ) {
        user = candidate;
        break;
      }
    }
    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'E-mail ou senha inválidos.',
      });
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Conta suspensa. Fale com o administrador.',
      });
    }
    if (user.mfaEnabled && !dto.totpCode) {
      throw new UnauthorizedException({
        code: 'MFA_REQUIRED',
        message: 'Informe o código do autenticador (campo totpCode).',
      });
    }
    if (user.mfaEnabled && !this.mfa.verifyLoginTotp(user, dto.totpCode)) {
      throw new UnauthorizedException({
        code: 'INVALID_TOTP',
        message: 'Código do autenticador inválido.',
      });
    }
    const session = await this.tokens.createSession(user);
    await this.audit.log({
      ...auditCtx,
      tenantId: user.tenantId,
      userId: user.id,
      action: AuditAction.LOGIN,
      entity: 'User',
      entityId: user.id,
      metadata: { method: 'password' },
    });
    return { user: toUserResponse(user), session };
  }

  async refresh(refreshToken: string | undefined, auditCtx: AuditContext) {
    const rotated = refreshToken
      ? await this.tokens.rotateSession(refreshToken)
      : null;
    if (!rotated) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH',
        message: 'Sessão expirada. Faça login novamente.',
      });
    }
    await this.audit.log({
      ...auditCtx,
      tenantId: rotated.user.tenantId,
      userId: rotated.user.id,
      action: AuditAction.TOKEN_REFRESHED,
      entity: 'User',
      entityId: rotated.user.id,
    });
    return { user: toUserResponse(rotated.user), session: rotated.session };
  }

  async logout(
    refreshToken: string | undefined,
    meta: AuditContext & { tenantId: string; userId: string },
  ) {
    if (refreshToken) await this.tokens.revokeSession(refreshToken);
    await this.audit.log({
      ...meta,
      action: AuditAction.LOGOUT,
      entity: 'User',
      entityId: meta.userId,
    });
  }

  async changePassword(
    currentUser: { id: string; tenantId: string },
    currentPassword: string,
    newPassword: string,
    auditCtx: AuditContext,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: currentUser.id, tenantId: currentUser.tenantId },
    });
    if (!user?.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'A senha atual está incorreta.',
      });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.users.hashPassword(newPassword) },
    });
    await this.audit.log({
      ...auditCtx,
      tenantId: user.tenantId,
      userId: user.id,
      action: AuditAction.PASSWORD_CHANGED,
      entity: 'User',
      entityId: user.id,
    });
    return { changed: true };
  }
}
