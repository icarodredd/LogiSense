import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator.js';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { PrismaService } from '../../database/prisma.service.js';
import { extractAuditContext } from '../audit/audit-context.js';
import { AuditAction } from '../audit/audit-action.js';
import { AuditService } from '../audit/audit.service.js';
import { ConfirmMfaDto, DisableMfaDto, LoginDto, RegisterDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { MfaService } from './mfa.service.js';
import { REFRESH_COOKIE } from './guards/jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(MfaService) private readonly mfa: MfaService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Public()
  @RateLimit(5, 60_000)
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tenant, session } = await this.auth.register(
      dto,
      extractAuditContext(req),
    );
    this.auth.setAuthCookies(res, session);
    return { user, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @RateLimit(10, 60_000)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, session } = await this.auth.login(dto, extractAuditContext(req));
    this.auth.setAuthCookies(res, session);
    return { user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const raw = cookies?.[REFRESH_COOKIE];
    const { user, session } = await this.auth.refresh(
      typeof raw === 'string' ? raw : undefined,
      extractAuditContext(req),
    );
    this.auth.setAuthCookies(res, session);
    return { user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const raw = cookies?.[REFRESH_COOKIE];
    await this.auth.logout(
      typeof raw === 'string' ? raw : undefined,
      { ...extractAuditContext(req), tenantId: user.tenantId, userId: user.id },
    );
    this.auth.clearAuthCookies(res);
    return { loggedOut: true };
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, tenantId: true, name: true, email: true, role: true },
    });
    if (!profile) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Sessão inválida.',
      });
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { id: true, name: true, slug: true },
    });
    return { user: profile, tenant };
  }

  // ---------------- MFA/TOTP (AGENTS.md §16) ----------------

  /** Passo 1: gera segredo pendente + QR Code. Usuário já autenticado. */
  @Post('mfa/setup')
  @HttpCode(200)
  async mfaSetup(@CurrentUser() user: AuthenticatedUser) {
    const full = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, mfaEnabled: true, mfaSecret: true },
    });
    if (!full) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Sessão inválida.',
      });
    }
    return this.mfa.beginSetup(full);
  }

  /** Passo 2: valida o código e ativa o MFA. */
  @Post('mfa/confirm')
  @HttpCode(200)
  @RateLimit(5, 60_000)
  async mfaConfirm(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmMfaDto,
    @Req() req: Request,
  ) {
    const full = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, mfaEnabled: true, mfaSecret: true },
    });
    if (!full) throw new NotFoundException();
    const result = await this.mfa.confirmSetup(full, dto.totpCode);
    await this.audit.log({
      ...extractAuditContext(req),
      tenantId: user.tenantId,
      userId: user.id,
      action: AuditAction.MFA_ENABLED,
      entity: 'User',
      entityId: user.id,
    });
    return result;
  }

  /** Desativa MFA: exige senha correta + TOTP válido. */
  @Post('mfa/disable')
  @HttpCode(200)
  @RateLimit(5, 60_000)
  async mfaDisable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DisableMfaDto,
    @Req() req: Request,
  ) {
    const full = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, mfaEnabled: true, mfaSecret: true, passwordHash: true },
    });
    if (!full) throw new NotFoundException();
    const passwordOk = full.passwordHash
      ? await bcrypt.compare(dto.password, full.passwordHash)
      : false;
    if (!passwordOk) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Senha incorreta.',
      });
    }
    const result = await this.mfa.disable(full, dto.totpCode);
    await this.audit.log({
      ...extractAuditContext(req),
      tenantId: user.tenantId,
      userId: user.id,
      action: AuditAction.MFA_DISABLED,
      entity: 'User',
      entityId: user.id,
    });
    return result;
  }
}
