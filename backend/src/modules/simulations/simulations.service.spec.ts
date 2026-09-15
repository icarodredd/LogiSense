import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi, type Mock } from 'vitest';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { SimulationsService } from './simulations.service.js';
import { FreightService } from '../freight/freight.service.js';

const me: AuthenticatedUser = {
  id: 'me-id',
  tenantId: 'tenant-1',
  email: 'admin@acme',
  role: 'ADMIN',
};

const auditCtx = { ip: '127.0.0.1' };

function setup(overrides: {
  freight?: FreightService;
  prismaSimulation?: Record<string, Mock>;
  prismaCarrier?: Record<string, Mock>;
  prismaCustomer?: Record<string, Mock>;
} = {}) {
  const freight = overrides.freight ?? new FreightService();
  const prisma = {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        freightSimulation: { create: vi.fn().mockResolvedValue({ id: 's1' }) },
        simulationQuote: { createMany: vi.fn() },
      }),
    ),
    customer: {
      findFirst: vi.fn(),
      ...overrides.prismaCustomer,
    },
    carrier: {
      findMany: vi.fn(),
      ...overrides.prismaCarrier,
    },
    freightSimulation: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      ...overrides.prismaSimulation,
    },
    simulationQuote: {
      createMany: vi.fn(),
    },
  };
  const audit = { log: vi.fn().mockResolvedValue(undefined) };
  const service = new SimulationsService(prisma as never, audit as never, freight);
  return { service, prisma, audit, freight };
}

describe('SimulationsService — create', () => {
  it('rejeita customerId de outro tenant', async () => {
    const { service, prisma } = setup();
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(
      service.create(me, {
        origin: 'São Paulo',
        destination: 'Fortaleza',
        weightKg: 100,
        lengthCm: 100,
        widthCm: 100,
        heightCm: 100,
        cargoValue: 5000,
        customerId: 'c-other-tenant',
      } as never,
      auditCtx),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejeita rota não catalogada', async () => {
    const { service } = setup();
    await expect(
      service.create(me, {
        origin: 'X',
        destination: 'Y',
        weightKg: 100,
        lengthCm: 100,
        widthCm: 100,
        heightCm: 100,
        cargoValue: 5000,
      } as never,
      auditCtx),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cria simulação com cotações para carriers ativos do tenant', async () => {
    const { service, prisma } = setup();
    prisma.customer.findFirst.mockResolvedValue(null);
    prisma.carrier.findMany.mockResolvedValue([
      { id: 'k1', name: 'K', baseFee: 50, pricePerKg: 2, pricePerKm: 0.6, riskPercent: 0.005, cubingFactor: 6000, active: true },
      { id: 'k2', name: 'L', baseFee: 60, pricePerKg: 1.8, pricePerKm: 0.55, riskPercent: 0.004, cubingFactor: 6000, active: true },
    ]);
    prisma.freightSimulation.create.mockResolvedValue({ id: 's1' });
    prisma.freightSimulation.findUnique.mockResolvedValue({
      id: 's1',
      tenantId: 'tenant-1',
      userId: 'me-id',
      customerId: null,
      origin: 'São Paulo',
      destination: 'Fortaleza',
      weightKg: 100,
      lengthCm: 100,
      widthCm: 100,
      heightCm: 100,
      cargoValue: 5000,
      distanceKm: 3100,
      volumetricWeightKg: null,
      chargeableWeightKg: null,
      status: 'COMPLETED',
      createdAt: new Date(),
      quotes: [],
    });
    const result = await service.create(me, {
      origin: 'São Paulo',
      destination: 'Fortaleza',
      weightKg: 100,
      lengthCm: 100,
      widthCm: 100,
      heightCm: 100,
      cargoValue: 5000,
    } as never, auditCtx);
    expect(prisma.carrier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', active: true }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.id).toBe('s1');
    expect(result.quotes.length).toBe(0);
  });
});

describe('SimulationsService — isolamento por tenant', () => {
  it('list filtra pelo tenant', async () => {
    const { service, prisma } = setup();
    prisma.freightSimulation.count.mockResolvedValue(0);
    prisma.freightSimulation.findMany.mockResolvedValue([]);
    await service.list(me, { page: 1, limit: 20 });
    expect(prisma.freightSimulation.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) }),
    );
    expect(prisma.freightSimulation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          quotes: { include: { carrier: { select: { id: true, name: true } } } },
        },
      }),
    );
  });

  it('findById nunca retorna simulação de outro tenant', async () => {
    const { service, prisma } = setup();
    prisma.freightSimulation.findFirst.mockResolvedValue(null);
    await expect(service.findById(me, 'other-sim')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.freightSimulation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'other-sim', tenantId: 'tenant-1' } }),
    );
  });
});
