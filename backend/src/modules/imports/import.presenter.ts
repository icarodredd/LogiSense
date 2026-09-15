import { toImportResponse } from './import.presenter.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { AuditAction } from '../audit/audit-action.js';
import { AuditService, type AuditContext } from '../audit/audit.service.js';
import { ImportStatus } from '@prisma/client';

export function toImportResponse(imp: {
  id: string;
  tenantId: string;
  userId: string | null;
  filename: string;
  storedPath?: string | null;
  mimeType?: string | null;
  type: ImportStatus;
  sizeBytes: number;
  status: ImportStatus;
  totalRows: number;
  processedRows: number;
  errorMessage?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
}) {
  return {
    id: imp.id,
    tenantId: imp.tenantId,
    userId: imp.userId ?? undefined,
    filename: imp.filename,
    storedPath: imp.storedPath,
    mimeType: imp.mimeType,
    type: imp.type,
    sizeBytes: imp.sizeBytes,
    status: imp.status,
    totalRows: imp.totalRows,
    processedRows: imp.processedRows,
    errorMessage: imp.errorMessage,
    createdAt: imp.createdAt,
    completedAt: imp.completedAt,
  };
}
