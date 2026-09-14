import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';

export interface AuditContext {
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

export interface AuditEntry extends AuditContext {
  tenantId: string;
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEYS = /token|secret|password|hash|authorization/i;

function sanitizeMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.test(key)) continue;
    clean[key] = value;
  }
  return clean as Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        metadata: sanitizeMetadata(entry.metadata),
        ip: entry.ip,
        userAgent: entry.userAgent,
        requestId: entry.requestId,
      },
    });
  }
}
