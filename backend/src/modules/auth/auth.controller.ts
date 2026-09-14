import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { PrismaService } from '../../database/prisma.service.js';
import { extractAuditContext } from '../audit/audit-context.js';
import { LoginDto, RegisterDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { REFRESH_COOKIE } from './guards/jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
  async me(@CurrentUser() user: AuthenticatedUser) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { id: true, name: true, slug: true },
    });
    return { user, tenant };
  }
}
