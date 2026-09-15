import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
function toNumber(value: number | { toNumber(): number }): number {
  return typeof value === 'number' ? value : value.toNumber();
}

export interface DashboardOverview {
  totalSimulations: number;
  avgFreight: number;
  minFreight: number;
  maxFreight: number;
  potentialSavings: number;
  carriersUsed: number;
  topRoutes: Array<{ origin: string; destination: string; count: number }>;
  trendWeekly: Array<{ week: string; avgCost: number }>;
}

export interface DashboardCarrier {
  carrierId: string;
  carrierName: string;
  avgCost: number;
  totalCost: number;
  simulationCount: number;
}

export interface DashboardRoute {
  origin: string;
  destination: string;
  count: number;
  avgCost: number;
}

@Injectable()
export class DashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async overview(currentUser: AuthenticatedUser): Promise<DashboardOverview> {
    const simulations = await this.prisma.freightSimulation.findMany({
      where: { tenantId: currentUser.tenantId },
      include: { quotes: { select: { totalCost: true, isCheapest: true, carrierId: true } } },
    });

    if (simulations.length === 0) {
      return {
        totalSimulations: 0,
        avgFreight: 0,
        minFreight: 0,
        maxFreight: 0,
        potentialSavings: 0,
        carriersUsed: 0,
        topRoutes: [],
        trendWeekly: [],
      };
    }

    const cheapestCosts = simulations
      .flatMap((s) => s.quotes.filter((q) => q.isCheapest).map((q) => toNumber(q.totalCost)));

    const allCosts = cheapestCosts.length > 0 ? cheapestCosts : simulations.flatMap((s) => s.quotes.map((q) => toNumber(q.totalCost)));
    if (allCosts.length === 0) {
      return {
        totalSimulations: simulations.length,
        avgFreight: 0,
        minFreight: 0,
        maxFreight: 0,
        potentialSavings: 0,
        carriersUsed: 0,
        topRoutes: [],
        trendWeekly: [],
      };
    }

    const avgFreight = allCosts.reduce((a, b) => a + b, 0) / allCosts.length;
    const minFreight = Math.min(...allCosts);
    const maxFreight = Math.max(...allCosts);

    let potentialSavings = 0;
    for (const sim of simulations) {
      if (sim.quotes.length === 0) continue;
      const cheapest = sim.quotes.reduce(
        (a, b) => (toNumber(a.totalCost) <= toNumber(b.totalCost) ? a : b),
      );
      const selected = sim.quotes.find((q) => q.isCheapest);
      if (selected && cheapest && toNumber(cheapest.totalCost) < toNumber(selected.totalCost)) {
        potentialSavings += toNumber(selected.totalCost) - toNumber(cheapest.totalCost);
      }
    }
    potentialSavings = Math.round(potentialSavings * 100) / 100;

    const carrierIds = new Set(simulations.flatMap((s) => s.quotes.map((q) => q.carrierId)));

    const routeCounts = new Map<string, number>();
    for (const sim of simulations) {
      const key = `${sim.origin}|${sim.destination}`;
      routeCounts.set(key, (routeCounts.get(key) ?? 0) + 1);
    }
    const topRoutes = Array.from(routeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => {
        const [origin, destination] = key.split('|');
        return { origin, destination, count };
      });

    const weeks = new Map<string, number[]>();
    for (const sim of simulations) {
      const startOfWeek = new Date(sim.createdAt);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const key = startOfWeek.toISOString().slice(0, 10);
      const costs = sim.quotes.filter((q) => q.isCheapest).map((q) => toNumber(q.totalCost));
      if (!weeks.has(key)) weeks.set(key, []);
      if (costs.length > 0) weeks.get(key)!.push(...costs);
    }
    const trendWeekly = Array.from(weeks.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-4)
      .map(([week, costs]) => ({
        week,
        avgCost:
          costs.length > 0
            ? Math.round((costs.reduce((a, b) => a + b, 0) / costs.length) * 100) / 100
            : 0,
      }));

    return {
      totalSimulations: simulations.length,
      avgFreight: Math.round(avgFreight * 100) / 100,
      minFreight,
      maxFreight,
      potentialSavings,
      carriersUsed: carrierIds.size,
      topRoutes,
      trendWeekly,
    };
  }

  async carriers(currentUser: AuthenticatedUser): Promise<DashboardCarrier[]> {
    const quotes = await this.prisma.simulationQuote.findMany({
      where: { simulation: { tenantId: currentUser.tenantId } },
      include: { carrier: { select: { id: true, name: true } } },
    });

    const grouped = new Map<string, { totalCost: number; count: number; name: string }>();
    for (const q of quotes) {
      const id = q.carrierId;
      const name = q.carrier.name;
      const totalCost = toNumber(q.totalCost);
      const existing = grouped.get(id);
      if (existing) {
        existing.totalCost += totalCost;
        existing.count++;
      } else {
        grouped.set(id, { totalCost, count: 1, name });
      }
    }

    return Array.from(grouped.entries()).map(([id, data]) => ({
      carrierId: id,
      carrierName: data.name,
      avgCost: Math.round((data.totalCost / data.count) * 100) / 100,
      totalCost: Math.round(data.totalCost * 100) / 100,
      simulationCount: data.count,
    }));
  }

  async routes(currentUser: AuthenticatedUser): Promise<DashboardRoute[]> {
    const simulations = await this.prisma.freightSimulation.findMany({
      where: { tenantId: currentUser.tenantId },
      include: { quotes: { select: { totalCost: true } } },
    });

    const routeMap = new Map<string, { count: number; totalCost: number }>();
    for (const sim of simulations) {
      const key = `${sim.origin}|${sim.destination}`;
      const costs = sim.quotes.map((q) => toNumber(q.totalCost));
      const avgCost = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
      const existing = routeMap.get(key);
      if (existing) {
        existing.count++;
        existing.totalCost += avgCost;
      } else {
        routeMap.set(key, { count: 1, totalCost: avgCost });
      }
    }

    return Array.from(routeMap.entries())
      .map(([key, data]) => {
        const [origin, destination] = key.split('|');
        return { origin, destination, count: data.count, avgCost: Math.round(data.totalCost * 100) / 100 };
      })
      .sort((a, b) => b.count - a.count);
  }
}
