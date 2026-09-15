import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { CarriersService } from './carriers.service.js';

const me: AuthenticatedUser = {
  id: 'me-id',
  tenantId: 'tenant-1',
  email: 'admin@acme',
  role: 'ADMIN',
};

const auditCtx = { ip: '127.0.0.1' };

function setup() {
  const prisma = {
    carrier: {
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
  const service = new CarriersService(prisma as never, audit as never);
  return { service, prisma, audit };
}

describe('CarriersService — isolamento por tenant', () => {
  it('list filtra sempre pelo tenant autenticado', async () => {
    const { service, prisma } = setup();
    prisma.carrier.count.mockResolvedValue(0);
    prisma.carrier.findMany.mockResolvedValue([]);
    await service.list(me, { page: 1, limit: 20 });
    expect(prisma.carrier.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) }),
    );
  });

  it('findById nunca retorna transportadora de outro tenant', async () => {
    const { service, prisma } = setup();
    prisma.carrier.findFirst.mockResolvedValue(null);
    await expect(service.findById(me, 'outro-tenant-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.carrier.findFirst).toHaveBeenCalledWith({
      where: { id: 'outro-tenant-id', tenantId: 'tenant-1' },
    });
  });
});

describe('CarriersService — regras', () => {
  it('remove lança FORBIDDEN se carrier tem simulações', async () => {
    const { service, prisma } = setup();
    prisma.carrier.findFirst.mockResolvedValue({ id: 'k1', name: 'K' });
    prisma.freightSimulation.findFirst.mockResolvedValue({ id: 's1' });
    await expect(service.remove(me, 'k1', auditCtx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('remove deleta e loga CARRIER_DELETED', async () => {
    const { service, prisma, audit } = setup();
    prisma.carrier.findFirst.mockResolvedValue({ id: 'k1', name: 'K' });
    prisma.freightSimulation.findFirst.mockResolvedValue(null);
    prisma.carrier.delete.mockResolvedValue({ id: 'k1' });
    await service.remove(me, 'k1', auditCtx);
    expect(prisma.carrier.delete).toHaveBeenCalledWith({ where: { id: 'k1' } });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CARRIER_DELETED',
        entity: 'Carrier',
        entityId: 'k1',
      }),
    );
  });
});
