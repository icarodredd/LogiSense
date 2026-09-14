import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type { AccessTokenPayload } from './guards/jwt-auth.guard.js';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

/** Converte '15m' | '7d' | '3600s' | '2h' em milissegundos (para maxAge do cookie). */
export function parseDurationToMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return amount * factor;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class TokenService {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async createSession(user: User): Promise<SessionTokens> {
    const accessExpiresIn =
      this.config.get<string>('jwt.accessExpiresIn', { infer: true }) ?? '15m';
    const refreshExpiresIn =
      this.config.get<string>('jwt.refreshExpiresIn', { infer: true }) ?? '7d';

    const payload: AccessTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret', { infer: true }),
      // @nestjs/jwt v12 tipa expiresIn como number | StringValue:
      // convertemos para segundos para aceitar qualquer duração válida.
      expiresIn: Math.floor(parseDurationToMs(accessExpiresIn) / 1000),
    });

    const refreshToken = randomBytes(48).toString('hex');
    const refreshExpiresAt = new Date(Date.now() + parseDurationToMs(refreshExpiresIn));

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      accessExpiresAt: new Date(Date.now() + parseDurationToMs(accessExpiresIn)),
      refreshExpiresAt,
    };
  }

  /** Valida o refresh token opaco, revoga (rotação) e emite nova sessão. Retorna null se inválido. */
  async rotateSession(refreshToken: string): Promise<{ user: User; session: SessionTokens } | null> {
    if (!refreshToken) return null;
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) return null;
    if (stored.user.status !== 'ACTIVE') return null;

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const session = await this.createSession(stored.user);
    return { user: stored.user, session };
  }

  async revokeSession(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
