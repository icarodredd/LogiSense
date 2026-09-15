import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { AuditAction } from '../audit/audit-action.js';
import { AuditService, type AuditContext } from '../audit/audit.service.js';
import { ImportProcessor } from '../../queue/import.processor.js';
import { ImportStatus, ImportType } from '@prisma/client';
import { toImportResponse } from './import.presenter.js';
import type { ImportFileDto } from './import.dto.js';

@Injectable()
export class ImportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ImportProcessor) private readonly processor: ImportProcessor,
  ) {}

  async list(currentUser: AuthenticatedUser, query: { page?: number; limit?: number; status?: string }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = {
      tenantId: currentUser.tenantId,
      ...(query.status ? { status: query.status as ImportStatus } : {}),
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

  async create(currentUser: AuthenticatedUser, dto: ImportFileDto, filePath: string, auditCtx: AuditContext) {
    const imp = await this.prisma.import.create({
      data: {
        tenantId: currentUser.tenantId,
        userId: currentUser.id,
        filename: dto.filename,
        storedPath: filePath,
        mimeType: dto.type,
        type: dto.type as ImportType,
        sizeBytes: dto.sizeBytes,
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
      metadata: { filename: imp.filename, type: imp.type },
    });

    await this.processor.addImportJob({
      importId: imp.id,
      tenantId: currentUser.tenantId,
      userId: currentUser.id,
      filename: imp.filename,
      type: imp.type,
      filePath: imp.storedPath ?? '',
      mimeType: imp.mimeType ?? '',
      sizeBytes: imp.sizeBytes,
    });

    await this.prisma.import.update({
      where: { id: imp.id },
      data: { status: ImportStatus.PROCESSING },
    });

    return toImportResponse(imp);
  }
}
