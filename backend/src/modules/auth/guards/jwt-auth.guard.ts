import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../../database/prisma.service.js';

export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: AuthenticatedUser['role'];
}

export const ACCESS_COOKIE = 'ls_access';
export const REFRESH_COOKIE = 'ls_refresh';

export function extractTokenFromRequest(req: Request): string | null {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const fromCookie = cookies?.[ACCESS_COOKIE];
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token = extractTokenFromRequest(req);
    if (!token) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Autenticação necessária.',
      });
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get<string>('jwt.accessSecret', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Sessão inválida ou expirada.',
      });
    }

    // Valida que o usuário continua existindo e ativo no tenant do token.
    // O tenantId SEMPRE vem do token — nunca do request (AGENTS.md §7).
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, tenantId: true, email: true, role: true, status: true },
    });
    if (!user || user.tenantId !== payload.tenantId) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Sessão inválida ou expirada.',
      });
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Conta suspensa. Fale com o administrador.',
      });
    }

    (req as Request & { user: AuthenticatedUser }).user = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };
    return true;
  }
}
