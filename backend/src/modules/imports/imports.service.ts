import { Inject, Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PrismaService } from '../../database/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { AuditAction } from '../audit/audit-action.js';
import { AuditService, type AuditContext } from '../audit/audit.service.js';
import { ImportProcessor } from '../../queue/import.processor.js';
import { ImportStatus } from '@prisma/client';
import { toImportResponse } from './import.presenter.js';
import type { ImportFileMeta, ListImportsQueryDto } from './import.dto.js';
import { getPagination } from '../../common/http/pagination.js';

@Injectable()
export class ImportsService implements OnModuleInit {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ImportProcessor) private readonly processor: ImportProcessor,
  ) {}

  async onModuleInit() {
    const uploadDir = this.processor.uploadDir;
    await mkdir(dirname(uploadDir), { recursive: true });
    await mkdir(uploadDir, { recursive: true });
  }

  async list(currentUser: AuthenticatedUser, query: ListImportsQueryDto) {
    const { page, limit } = getPagination(query);
    const where: Record<string, unknown> = {
      tenantId: currentUser.tenantId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, imports] = await Promise.all([
      this.prisma.import.count({ where }),
      this.prisma.import.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items: imports.map((imp) => toImportResponse(imp)), total, page, limit };
  }

  async findById(currentUser: AuthenticatedUser, id: string) {
    const imp = await this.prisma.import.findFirst({
      where: { id, tenantId: currentUser.tenantId },
    });
    if (!imp) {
      throw new NotFoundException({
        code: 'IMPORT_NOT_FOUND',
        message: 'Import não encontrado.',
      });
    }
    return toImportResponse(imp);
  }

  async create(
    currentUser: AuthenticatedUser,
    meta: ImportFileMeta,
    auditCtx: AuditContext,
  ) {
    const imp = await this.prisma.import.create({
      data: {
        tenantId: currentUser.tenantId,
        userId: currentUser.id,
        filename: meta.originalName,
        storedPath: meta.storedPath,
        mimeType: meta.mimeType,
        type: meta.type,
        sizeBytes: meta.sizeBytes,
        status: ImportStatus.PENDING,
      },
    });

    await this.audit.log({
      ...auditCtx,
      tenantId: currentUser.tenantId,
      userId: currentUser.id,
      action: AuditAction.IMPORT_STARTED,
      entity: 'Import',
      entityId: imp.id,
      metadata: { filename: imp.filename, type: imp.type, sizeBytes: imp.sizeBytes },
    });

    await this.processor.addImportJob({
      importId: imp.id,
      tenantId: currentUser.tenantId,
      userId: currentUser.id,
      type: imp.type,
      filePath: imp.storedPath ?? '',
      mimeType: imp.mimeType ?? '',
      filename: imp.filename,
      sizeBytes: imp.sizeBytes,
      auditCtx: {
        ip: auditCtx.ip,
        userAgent: auditCtx.userAgent,
        requestId: auditCtx.requestId,
      },
    });

    const updated = await this.prisma.import.update({
      where: { id: imp.id },
      data: { status: ImportStatus.PROCESSING },
    });

    return toImportResponse(updated);
  }

  async retry(currentUser: AuthenticatedUser, id: string) {
    const imp = await this.prisma.import.findFirst({
      where: { id, tenantId: currentUser.tenantId },
    });
    if (!imp) {
      throw new NotFoundException({
        code: 'IMPORT_NOT_FOUND',
        message: 'Import não encontrado.',
      });
    }
    if (imp.status !== ImportStatus.FAILED) {
      throw new BadRequestException({
        code: 'IMPORT_NOT_FAILED',
        message: 'Apenas imports com status FAILED podem ser reprocessados.',
      });
    }

    await this.audit.log({
      tenantId: currentUser.tenantId,
      userId: currentUser.id,
      action: AuditAction.IMPORT_STARTED,
      entity: 'Import',
      entityId: imp.id,
      metadata: { filename: imp.filename, type: imp.type, retry: true },
    });

    await this.processor.addImportJob({
      importId: imp.id,
      tenantId: currentUser.tenantId,
      userId: currentUser.id,
      type: imp.type,
      filePath: imp.storedPath ?? '',
      mimeType: imp.mimeType ?? '',
      filename: imp.filename,
      sizeBytes: imp.sizeBytes,
      auditCtx: {},
    });

    const updated = await this.prisma.import.update({
      where: { id: imp.id },
      data: { status: ImportStatus.PROCESSING, errorMessage: null, completedAt: null },
    });

    return toImportResponse(updated);
  }
}
