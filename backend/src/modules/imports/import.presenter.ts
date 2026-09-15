import { ImportType, ImportStatus } from '@prisma/client';

export function toImportResponse(imp: {
  id: string;
  tenantId: string;
  userId: string | null;
  filename: string;
  storedPath?: string | null;
  mimeType?: string | null;
  type: ImportType;
  sizeBytes: number;
  status: ImportStatus;
  totalRows: number;
  processedRows: number;
  errorMessage?: string | null;
  createdAt: Date;
  completedAt: Date | null;
}) {
  return {
    id: imp.id,
    tenantId: imp.tenantId,
    userId: imp.userId,
    filename: imp.filename,
    type: imp.type,
    sizeBytes: imp.sizeBytes,
    status: imp.status,
    totalRows: imp.totalRows,
    processedRows: imp.processedRows,
    errorMessage: imp.errorMessage ?? null,
    createdAt: imp.createdAt,
    completedAt: imp.completedAt,
  };
}
