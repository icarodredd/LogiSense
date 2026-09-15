import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import { PrismaService } from '../database/prisma.service.js';
import type { AccessTokenPayload } from '../modules/auth/guards/jwt-auth.guard.js';

export interface WsUser {
  id: string;
  tenantId: string;
  email: string;
  role: string;
}

@Injectable()
export class WsAuthService {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  extractToken(client: Socket): string | null {
    const fromAuth = client.handshake.auth?.token;
    if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;
    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }
    return null;
  }

  async authenticate(client: Socket): Promise<WsUser> {
    const token = this.extractToken(client);
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

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, tenantId: true, email: true, role: true, status: true },
    });
    if (!user || user.tenantId !== payload.tenantId || user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Sessão inválida ou expirada.',
      });
    }

    return { id: user.id, tenantId: user.tenantId, email: user.email, role: user.role };
  }

  extractSocketUser(client: Socket): WsUser | undefined {
    return client.data?.user as WsUser | undefined;
  }
}
