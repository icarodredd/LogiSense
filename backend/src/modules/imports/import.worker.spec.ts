import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ImportWorker } from './import.worker.js';
import { ImportStatus, ImportType } from '@prisma/client';

const me = { id: 'user-1' };
const tenantId = 'tenant-1';
const auditCtx = { ip: '127.0.0.1', requestId: 'req-1' };

function makeDeps() {
  const ws = { emitImportProgress: vi.fn() };
  const savedImports = new Map<string, Record<string, unknown>>();
  const savedCustomers: Record<string, unknown>[] = [];
  const savedCarriers: Record<string, unknown>[] = [];

  const prisma = {
    import: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; tenantId: string } }) => {
        if (where.id !== 'imp-1' || where.tenantId !== tenantId) return null;
        return savedImports.get('imp-1') ?? {
          id: 'imp-1',
          tenantId,
          filename: 'clientes.csv',
        };
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const current = savedImports.get(where.id) ?? { id: where.id, tenantId };
        savedImports.set(where.id, { ...current, ...data });
        return { count: 1 };
      }),
    },
    customer: {
      findFirst: vi.fn(async ({ where }: { where: { tenantId: string; document?: string; name?: string } }) => {
        return (
          savedCustomers.find(
            (c) =>
              c.tenantId === where.tenantId &&
              (where.document !== undefined ? c.document === where.document : c.name === where.name),
          ) ?? null
        );
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        savedCustomers.push({ id: `cust-${savedCustomers.length + 1}`, ...data });
        return savedCustomers[savedCustomers.length - 1];
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const idx = savedCustomers.findIndex((c) => c.id === where.id);
        if (idx === -1) throw new Error('not found');
        savedCustomers[idx] = { ...savedCustomers[idx], ...data };
        return savedCustomers[idx];
      }),
    },
    carrier: {
      findFirst: vi.fn(async ({ where }: { where: { tenantId: string; name: string } }) => {
        return (
          savedCarriers.find(
            (c) => c.tenantId === where.tenantId && c.name === where.name,
          ) ?? null
        );
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        savedCarriers.push({ id: `carrier-${savedCarriers.length + 1}`, ...data });
        return savedCarriers[savedCarriers.length - 1];
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const idx = savedCarriers.findIndex((c) => c.id === where.id);
        if (idx === -1) throw new Error('not found');
        savedCarriers[idx] = { ...savedCarriers[idx], ...data };
        return savedCarriers[idx];
      }),
    },
  };

  const audit = { log: vi.fn().mockResolvedValue(undefined) };
  const worker = new ImportWorker(ws as never, prisma as never, audit as never);
  return { worker, ws, prisma, audit, savedCustomers, savedCarriers, savedImports };
}

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'logisense-import-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('ImportWorker — CUSTOMERS', () => {
  it('processa CSV de clientes: cria novos e faz upsert de duplicados', async () => {
    const deps = makeDeps();
    const csv = [
      'name,document,cep,email,city,state',
      'Novo Cliente,12345678901,01000000,novo@x.com,São Paulo,SP',
      'Outro Cliente,98765432100,02000000,outro@x.com,Rio de Janeiro,RJ',
    ].join('\n');
    const filePath = join(tempDir, 'clientes.csv');
    await writeFile(filePath, csv, 'utf-8');

    await deps.worker.process('imp-1', tenantId, filePath, 'text/csv', ImportType.CUSTOMERS, auditCtx, me.id);

    expect(deps.savedCustomers).toHaveLength(2);
    expect(deps.savedCustomers[0]).toMatchObject({
      name: 'Novo Cliente',
      document: '12345678901',
      tenantId,
    });

    expect(deps.savedImports.get('imp-1')).toMatchObject({
      status: ImportStatus.COMPLETED,
      totalRows: 2,
      processedRows: 2,
    });
    expect(deps.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'IMPORT_COMPLETED', tenantId }),
    );

    const completed = deps.ws.emitImportProgress.mock.calls.at(-1)?.[1];
    expect(completed).toMatchObject({ status: 'COMPLETED', percentage: 100 });
  });

  it('é idempotente: reimportar mesmos dados atualiza em vez de duplicar', async () => {
    const deps = makeDeps();
    const csv = 'name,document\nCliente X,11122233344';
    const file1 = join(tempDir, 'clientes-1.csv');
    const file2 = join(tempDir, 'clientes-2.csv');
    await writeFile(file1, csv, 'utf-8');
    await writeFile(file2, csv, 'utf-8');

    await deps.worker.process('imp-1', tenantId, file1, 'text/csv', ImportType.CUSTOMERS, auditCtx, me.id);
    await deps.worker.process('imp-1', tenantId, file2, 'text/csv', ImportType.CUSTOMERS, auditCtx, me.id);

    expect(deps.savedCustomers).toHaveLength(1);
    expect(deps.prisma.customer.create).toHaveBeenCalledTimes(1);
    expect(deps.prisma.customer.update).toHaveBeenCalledTimes(1);
  });

  it('pula linhas sem nome', async () => {
    const deps = makeDeps();
    const csv = 'name,document\n,123\nValido,456';
    const filePath = join(tempDir, 'clientes.csv');
    await writeFile(filePath, csv, 'utf-8');

    await deps.worker.process('imp-1', tenantId, filePath, 'text/csv', ImportType.CUSTOMERS, auditCtx, me.id);

    expect(deps.savedCustomers).toHaveLength(1);
    expect(deps.savedCustomers[0]).toMatchObject({ name: 'Valido' });
  });
});

describe('ImportWorker — CARRIERS', () => {
  it('processa CSV de transportadoras com parâmetros de precificação', async () => {
    const deps = makeDeps();
    const csv = [
      'name,baseFee,pricePerKg,pricePerKm,riskPercent,cubingFactor',
      'TransNova,40,1.9,0.65,0.004,6000',
    ].join('\n');
    const filePath = join(tempDir, 'carriers.csv');
    await writeFile(filePath, csv, 'utf-8');

    await deps.worker.process('imp-1', tenantId, filePath, 'text/csv', ImportType.CARRIERS, auditCtx, me.id);

    expect(deps.savedCarriers).toHaveLength(1);
    expect(deps.savedCarriers[0]).toMatchObject({
      name: 'TransNova',
      baseFee: 40,
      pricePerKg: 1.9,
      pricePerKm: 0.65,
      riskPercent: 0.004,
      cubingFactor: 6000,
      tenantId,
    });
  });

  it('usa vírgula decimal em parâmetros', async () => {
    const deps = makeDeps();
    const csv = 'name,pricePerKg\nBrasileirinha,"1,85"';
    const filePath = join(tempDir, 'carriers.csv');
    await writeFile(filePath, csv, 'utf-8');

    await deps.worker.process('imp-1', tenantId, filePath, 'text/csv', ImportType.CARRIERS, auditCtx, me.id);

    expect(deps.savedCarriers[0]).toMatchObject({ pricePerKg: 1.85 });
  });
});

describe('ImportWorker — erros e isolamento', () => {
  it('falha com arquivo de tipo não suportado', async () => {
    const deps = makeDeps();
    const filePath = join(tempDir, 'arquivo.xyz');
    await writeFile(filePath, 'foo', 'utf-8');

    await deps.worker.process('imp-1', tenantId, filePath, 'application/octet-stream', ImportType.CUSTOMERS, auditCtx, me.id);

    expect(deps.savedImports.get('imp-1')).toMatchObject({ status: ImportStatus.FAILED });
    expect(deps.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'IMPORT_FAILED', tenantId }),
    );
  });

  it('não processa import de outro tenant', async () => {
    const deps = makeDeps();
    const filePath = join(tempDir, 'clientes.csv');
    await writeFile(filePath, 'name\nX', 'utf-8');

    await deps.worker.process('imp-1', 'tenant-intruso', filePath, 'text/csv', ImportType.CUSTOMERS, auditCtx, me.id);

    expect(deps.savedCustomers).toHaveLength(0);
  });

  it('rejeita tipo SIMULATIONS com erro claro', async () => {
    const deps = makeDeps();
    const filePath = join(tempDir, 'simulacoes.csv');
    await writeFile(filePath, 'origin,destination\nX,Y', 'utf-8');

    await deps.worker.process('imp-1', tenantId, filePath, 'text/csv', ImportType.SIMULATIONS, auditCtx, me.id);

    expect(deps.savedImports.get('imp-1')).toMatchObject({
      status: ImportStatus.FAILED,
      errorMessage: 'Import do tipo SIMULATIONS ainda não suportado.',
    });
  });
});
