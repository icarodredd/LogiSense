import { describe, expect, it, vi } from 'vitest';
import { InsightsService } from './insights.service.js';

const me = { id: 'me-id', tenantId: 'tenant-1', email: 'admin@acme', role: 'ADMIN' as const };

function setup(overrides: {
  sims?: Record<string, unknown>[];
  quotes?: Record<string, unknown>[];
  routes?: Record<string, unknown>[];
} = {}) {
  const sims = overrides.sims ?? [
    { id: 's1', createdAt: new Date('2026-08-01'), quotes: [{ totalCost: 5000, isCheapest: true }] },
    { id: 's2', createdAt: new Date('2026-08-08'), quotes: [{ totalCost: 6000, isCheapest: true }] },
  ];
  const quotes = overrides.quotes ?? [
    { carrierId: 'k1', totalCost: 5000, carrier: { id: 'k1', name: 'K' } },
    { carrierId: 'k2', totalCost: 5500, carrier: { id: 'k2', name: 'L' } },
  ];
  const routes = overrides.routes ?? [
    { id: 's1', origin: 'SP', destination: 'CE', quotes: [{ totalCost: 5000 }] },
    { id: 's2', origin: 'SP', destination: 'CE', quotes: [{ totalCost: 6000 }] },
    { id: 's3', origin: 'RJ', destination: 'SP', quotes: [{ totalCost: 4000 }] },
  ];
  const prisma = {
    insight: { create: vi.fn().mockImplementation((data: any) => Promise.resolve({ id: 'i1', ...data.data, isRead: false, createdAt: new Date(), metadata: {} })) },
    freightSimulation: { findMany: vi.fn().mockResolvedValue(sims) },
    simulationQuote: { findMany: vi.fn().mockResolvedValue(quotes) },
  };
  const service = new InsightsService(prisma as never);
  return { service, prisma, sims, quotes, routes };
}

describe('InsightsService — regenerate', () => {
  it('retorna vazio sem simulações', async () => {
    const { service } = setup({ sims: [] });
    const result = await service.regenerate(me);
    expect(result).toEqual([]);
  });

  it('gera insight de economia quando há economia potencial', async () => {
    const sims = [
      { id: 's1', createdAt: new Date('2026-08-01'), quotes: [
        { totalCost: 5000, isCheapest: true },
        { totalCost: 4000, isCheapest: false },
      ]},
    ];
    const { service } = setup({ sims });
    const result = await service.regenerate(me);
    expect(result.length).toBeGreaterThan(0);
    const economy = result.find((i) => i.type === 'economy');
    expect(economy).toBeDefined();
    expect(economy!.description).toContain('1.000');
  });

  it('gera insight de transportadora mais barata', async () => {
    const { service } = setup();
    const result = await service.regenerate(me);
    expect(result.length).toBeGreaterThan(0);
    const carrier = result.find((i) => i.type === 'carrier');
    expect(carrier).toBeDefined();
  });

  it('gera insight de concentração de rotas', async () => {
    const { service } = setup();
    const result = await service.regenerate(me);
    expect(result.length).toBeGreaterThan(0);
    const concentration = result.find((i) => i.type === 'concentration');
    expect(concentration).toBeDefined();
    expect(concentration!.description).toContain('%');
  });

  it('gera insight de tendência quando há variação', async () => {
    const now = new Date();
    const fourWeeksAgo = new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000);
    const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
    const sims = [
      { id: 's1', createdAt: new Date(eightWeeksAgo.getTime() + 60_000), quotes: [{ totalCost: 7000, isCheapest: true }] },
      { id: 's2', createdAt: new Date(eightWeeksAgo.getTime() + 60_000), quotes: [{ totalCost: 7000, isCheapest: true }] },
      { id: 's3', createdAt: new Date(fourWeeksAgo.getTime() + 60_000), quotes: [{ totalCost: 5000, isCheapest: true }] },
      { id: 's4', createdAt: new Date(fourWeeksAgo.getTime() + 60_000), quotes: [{ totalCost: 5000, isCheapest: true }] },
    ];
    const { service } = setup({ sims });
    const result = await service.regenerate(me);
    expect(result.length).toBeGreaterThan(0);
    const trend = result.find((i) => i.type === 'trend');
    expect(trend).toBeDefined();
  });
});
