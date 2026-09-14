import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  generateSecret,
  generateSync,
  generateURI,
  verifySync,
} from 'otplib';
import QRCode from 'qrcode';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { PrismaService } from '../../database/prisma.service.js';

export interface MfaSetupResponse {
  /** otpauth:// URI para configurar o autenticador. */
  otpauthUri: string;
  /** QR Code (PNG em data URI) contendo a otpauth URI. */
  qrCodeDataUri: string;
  /** Segredo em base32 (input manual no app autenticador). */
  secret: string;
}

/**
 * MFA/TOTP (AGENTS.md §16):
 *
 * 1. POST /auth/mfa/setup    — gera segredo pendente (cifrado em repouso);
 * 2. POST /auth/mfa/confirm  — valida 1 código TOTP -> MFA ativado;
 * 3. login com mfaEnabled    — exige `totpCode` além das credenciais;
 * 4. POST /auth/mfa/disable  — exige senha + TOTP válidos para desativar.
 *
 * O segredo TOTP é simétrico: precisa ser recuperável para verificar códigos.
 * É persistido cifrado com AES-256-GCM (nunca em texto puro, nunca em logs).
 */
@Injectable()
export class MfaService {
  private readonly encryptionKey: Buffer;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    const rawKey =
      config.get<string>('mfa.encryptionKey', { infer: true }) ?? 'dev-mfa-key';
    // Deriva chave estável de 32 bytes (AES-256) a partir do segredo de env.
    this.encryptionKey = scryptSync(rawKey, 'logisense-mfa', 32);
  }

  // ---------- Cripto (AES-256-GCM, formato: iv:tag:ciphertext em base64) ----------

  encryptSecret(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  decryptSecret(stored: string | null): string | null {
    if (!stored) return null;
    const parts = stored.split(':');
    if (parts.length !== 3) return null;
    try {
      const [iv, tag, ciphertext] = parts;
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        Buffer.from(iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      return null;
    }
  }

  // ---------- Fluxo de configuração ----------

  /** Passo 1: gera segredo pendente (não ativo até confirmação). */
  async beginSetup(
    user: { id: string; email: string; mfaEnabled: boolean },
  ): Promise<MfaSetupResponse> {
    if (user.mfaEnabled) {
      throw new BadRequestException({
        code: 'MFA_ALREADY_ENABLED',
        message: 'MFA já está ativado. Desative antes de configurar novamente.',
      });
    }
    const secret = generateSecret({ length: 20 });
    // Sobrescreve setup pendente anterior (um único segredo pendente por user).
    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaSecret: this.encryptSecret(secret), mfaEnabled: false },
    });
    const otpauthUri = generateURI({
      strategy: 'totp',
      issuer: 'LogiSense',
      label: user.email,
      secret,
    });
    const qrCodeDataUri = await QRCode.toDataURL(otpauthUri);
    return { otpauthUri, qrCodeDataUri, secret };
  }

  /** Passo 2: valida o primeiro código gerado pelo autenticador e ativa o MFA. */
  async confirmSetup(
    user: { id: string; mfaEnabled: boolean; mfaSecret: string | null },
    totpCode: string | undefined,
  ): Promise<{ mfaEnabled: true }> {
    if (user.mfaEnabled) {
      throw new BadRequestException({
        code: 'MFA_ALREADY_ENABLED',
        message: 'MFA já está ativado nesta conta.',
      });
    }
    const secret = this.decryptSecret(user.mfaSecret);
    if (!secret) {
      throw new BadRequestException({
        code: 'MFA_SETUP_NOT_FOUND',
        message: 'Configure o MFA antes de confirmar (POST /auth/mfa/setup).',
      });
    }
    if (!totpCode || !this.verifyCode(secret, totpCode)) {
      throw new BadRequestException({
        code: 'INVALID_TOTP',
        message: 'Código inválido. Verifique o autenticador e tente novamente.',
      });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true },
    });
    return { mfaEnabled: true };
  }

  /** Verifica TOTP no login. Retorna true quando MFA não está ativo. */
  verifyLoginTotp(
    user: { mfaEnabled: boolean; mfaSecret: string | null },
    totpCode: string | undefined,
  ): boolean {
    if (!user.mfaEnabled) return true;
    if (!totpCode) return false;
    const secret = this.decryptSecret(user.mfaSecret);
    if (!secret) return false;
    return this.verifyCode(secret, totpCode);
  }

  /** Desativa MFA: exige TOTP válido (senha verificada pelo controller/service). */
  async disable(
    user: { id: string; mfaEnabled: boolean; mfaSecret: string | null },
    totpCode: string | undefined,
  ): Promise<{ mfaEnabled: false }> {
    if (!user.mfaEnabled) {
      throw new BadRequestException({
        code: 'MFA_NOT_ENABLED',
        message: 'MFA não está ativado nesta conta.',
      });
    }
    const secret = this.decryptSecret(user.mfaSecret);
    if (!totpCode || !secret || !this.verifyCode(secret, totpCode)) {
      throw new UnauthorizedException({
        code: 'INVALID_TOTP',
        message: 'Código TOTP inválido.',
      });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    return { mfaEnabled: false };
  }

  private verifyCode(secret: string, totpCode: string): boolean {
    const { valid } = verifySync({
      strategy: 'totp',
      secret,
      token: totpCode.replace(/\s+/g, ''),
    });
    return valid;
  }
}

/** Gera um token TOTP válido para o segredo (usado em testes). */
export function generateTotpToken(secret: string): string {
  return generateSync({ strategy: 'totp', secret });
}
