import { describe, expect, it, vi } from 'vitest';
import { DashboardService } from './dashboard.service.js';

const me = { id: 'me-id', tenantId: 'tenant-1', email: 'admin@acme', role: 'ADMIN' as const };

function setup(simulations: Record<string, unknown>[]) {
  const prisma = {
    freightSimulation: {
      findMany: vi.fn().mockResolvedValue(simulations),
    },
    simulationQuote: {
      findMany: vi.fn(),
    },
  };
  const service = new DashboardService(prisma as never);
  return { service, prisma };
}

const SIM_WITH_QUOTES = [
  {
    id: 's1',
    origin: 'São Paulo',
    destination: 'Fortaleza',
    createdAt: new Date('2026-08-01'),
    quotes: [
      { carrierId: 'k1', totalCost: 5000, isCheapest: true },
      { carrierId: 'k2', totalCost: 5500, isCheapest: false },
    ],
  },
];

describe('DashboardService — overview', () => {
  it('retorna zeros quando não há simulações', async () => {
    const { service, prisma } = setup([]);
    prisma.freightSimulation.findMany.mockResolvedValue([]);
    const result = await service.overview(me);
    expect(result.totalSimulations).toBe(0);
    expect(result.avgFreight).toBe(0);
    expect(result.potentialSavings).toBe(0);
  });

  it('calcula KPIs corretamente', async () => {
    const { service } = setup(SIM_WITH_QUOTES);
    const result = await service.overview(me);
    expect(result.totalSimulations).toBe(1);
    expect(result.avgFreight).toBe(5000);
    expect(result.minFreight).toBe(5000);
    expect(result.maxFreight).toBe(5000);
    expect(result.carriersUsed).toBe(2);
    expect(result.topRoutes[0]?.origin).toBe('São Paulo');
    expect(result.topRoutes[0]?.destination).toBe('Fortaleza');
  });

  it('calcula potencial de economia', async () => {
    const sims = [
      {
        id: 's1',
        origin: 'SP',
        destination: 'CE',
        createdAt: new Date('2026-08-01'),
        quotes: [
          { carrierId: 'k1', totalCost: 5500, isCheapest: true },
          { carrierId: 'k2', totalCost: 5000, isCheapest: false },
        ],
      },
    ];
    const { service } = setup(sims);
    const result = await service.overview(me);
    expect(result.potentialSavings).toBe(500);
  });
});

describe('DashboardService — carriers', () => {
  it('agrupa por carrier', async () => {
    const prisma = {
      freightSimulation: { findMany: vi.fn().mockResolvedValue([]) },
      simulationQuote: {
        findMany: vi.fn().mockResolvedValue([
          { carrierId: 'k1', totalCost: 5000, carrier: { id: 'k1', name: 'K' } },
          { carrierId: 'k1', totalCost: 6000, carrier: { id: 'k1', name: 'K' } },
          { carrierId: 'k2', totalCost: 7000, carrier: { id: 'k2', name: 'L' } },
        ]),
      },
    };
    const service = new DashboardService(prisma as never);
    const result = await service.carriers(me);
    expect(result.length).toBe(2);
    const k = result.find((r) => r.carrierId === 'k1');
    expect(k?.avgCost).toBe(5500);
    expect(k?.simulationCount).toBe(2);
  });
});

describe('DashboardService — routes', () => {
  it('agrupa por rota', async () => {
    const prisma = {
      freightSimulation: {
        findMany: vi.fn().mockResolvedValue([
          { id: 's1', origin: 'SP', destination: 'CE', createdAt: new Date(), quotes: [{ totalCost: 5000 }] },
          { id: 's2', origin: 'SP', destination: 'CE', createdAt: new Date(), quotes: [{ totalCost: 5500 }] },
          { id: 's3', origin: 'RJ', destination: 'SP', createdAt: new Date(), quotes: [{ totalCost: 4000 }] },
        ]),
      },
      simulationQuote: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new DashboardService(prisma as never);
    const result = await service.routes(me);
    expect(result[0]?.count).toBe(2);
    expect(result[0]?.origin).toBe('SP');
    expect(result[1]?.count).toBe(1);
    expect(result[1]?.origin).toBe('RJ');
  });
});
