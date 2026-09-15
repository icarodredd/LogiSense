import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ImportsService } from './imports.service.js';
import { ImportStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '@prisma/client';

vi.mock('../../websocket/websocket.gateway.js', () => ({
  WebSocketGateway: class {},
}));

const me: AuthenticatedUser = {
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'admin@acme',
  role: UserRole.ADMIN,
};
const auditCtx = { ip: '127.0.0.1', requestId: 'req-1' };

const makePrisma = () => {
  const imp = { id: 'imp-1', tenantId: 'tenant-1', filename: 'test.csv', status: ImportStatus.PENDING, totalRows: 0, processedRows: 0 };
  return {
    import: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...imp,
        ...data,
        createdAt: new Date(),
        completedAt: null,
      })),
      findFirst: vi.fn(async () => imp),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...imp, ...data })),
      updateMany: vi.fn(),
      findMany: vi.fn(async () => [imp]),
      count: vi.fn(async () => 1),
    },
    auditLog: { create: vi.fn() },
  };
};

describe('ImportsService', () => {
  let service: ImportsService;
  let prisma: ReturnType<typeof makePrisma>;
  let processor: { addImportJob: ReturnType<typeof vi.fn>; uploadDir: string };
  let audit: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = makePrisma();
    processor = { addImportJob: vi.fn().mockResolvedValue(undefined), uploadDir: '/tmp/uploads' };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    service = new ImportsService(prisma as never, audit as never, processor as never);
  });

  it('onModuleInit garante que o diretório de uploads existe', async () => {
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('create grava metadados reais (mimeType, storedPath) e enfileira job', async () => {
    await service.create(
      me,
      {
        originalName: 'clientes.csv',
        storedPath: '/tmp/uploads/abc.csv',
        mimeType: 'text/csv',
        sizeBytes: 100,
        type: 'CUSTOMERS' as never,
      },
      auditCtx,
    );
    expect(prisma.import.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          filename: 'clientes.csv',
          storedPath: '/tmp/uploads/abc.csv',
          mimeType: 'text/csv',
          type: 'CUSTOMERS',
        }),
      }),
    );
    expect(processor.addImportJob).toHaveBeenCalledWith(
      expect.objectContaining({
        importId: 'imp-1',
        tenantId: 'tenant-1',
        filePath: '/tmp/uploads/abc.csv',
        mimeType: 'text/csv',
        type: 'CUSTOMERS',
        auditCtx: { ip: '127.0.0.1', requestId: 'req-1' },
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'IMPORT_STARTED', tenantId: 'tenant-1' }),
    );
    expect(prisma.import.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: ImportStatus.PROCESSING } }),
    );
  });

  it('findById lança NotFoundException para import inexistente', async () => {
    prisma.import.findFirst = vi.fn(async () => null) as unknown as typeof prisma.import.findFirst;
    await expect(service.findById(me, 'unknown')).rejects.toThrow(NotFoundException);
  });

  it('list filtra pelo tenant do usuário autenticado', async () => {
    await service.list(me, { page: 1, limit: 20 });
    expect(prisma.import.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    );
  });
});
