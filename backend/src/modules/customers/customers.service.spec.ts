import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { CustomersService } from './customers.service.js';

const me: AuthenticatedUser = {
  id: 'me-id',
  tenantId: 'tenant-1',
  email: 'admin@acme',
  role: 'ADMIN',
};

const auditCtx = { ip: '127.0.0.1' };

function setup() {
  const prisma = {
    customer: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    freightSimulation: {
      findFirst: vi.fn(),
    },
  };
  const audit = { log: vi.fn().mockResolvedValue(undefined) };
  const service = new CustomersService(prisma as never, audit as never);
  return { service, prisma, audit };
}

describe('CustomersService — isolamento por tenant', () => {
  it('list filtra sempre pelo tenant autenticado', async () => {
    const { service, prisma } = setup();
    prisma.customer.count.mockResolvedValue(0);
    prisma.customer.findMany.mockResolvedValue([]);
    await service.list(me, { page: 1, limit: 20 });
    expect(prisma.customer.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) }),
    );
    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) }),
    );
  });

  it('findById nunca retorna cliente de outro tenant', async () => {
    const { service, prisma } = setup();
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(service.findById(me, 'outro-tenant-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 'outro-tenant-id', tenantId: 'tenant-1' },
    });
  });
});

describe('CustomersService — regras', () => {
  it('create com documento duplicado acusa CONFLICT', async () => {
    const { service, prisma } = setup();
    prisma.customer.findFirst.mockResolvedValue({ id: 'x' });
    await expect(
      service.create(me, { name: 'N', document: '123' } as never, auditCtx),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('update lança NOT_FOUND se não existir', async () => {
    const { service, prisma } = setup();
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(
      service.update(me, 'nope', { name: 'Novo' } as never, auditCtx),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove lança FORBIDDEN se cliente tem simulações', async () => {
    const { service, prisma } = setup();
    prisma.customer.findFirst.mockResolvedValue({ id: 'c1', name: 'C' });
    prisma.freightSimulation.findFirst.mockResolvedValue({ id: 's1' });
    await expect(service.remove(me, 'c1', auditCtx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('remove deleta e loga CUSTOMER_DELETED', async () => {
    const { service, prisma, audit } = setup();
    prisma.customer.findFirst.mockResolvedValue({ id: 'c1', name: 'C' });
    prisma.freightSimulation.findFirst.mockResolvedValue(null);
    prisma.customer.delete.mockResolvedValue({ id: 'c1' });
    await service.remove(me, 'c1', auditCtx);
    expect(prisma.customer.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CUSTOMER_DELETED',
        entity: 'Customer',
        entityId: 'c1',
      }),
    );
  });
});
