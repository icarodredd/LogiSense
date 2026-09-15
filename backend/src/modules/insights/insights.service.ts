import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { InsightSeverity } from '@prisma/client';

export interface InsightItem {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: InsightSeverity;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: Date;
}

export interface InsightRule {
  type: 'economy' | 'carrier' | 'concentration' | 'trend';
  title: string;
  description: string;
  severity: InsightSeverity;
  metadata: Record<string, unknown>;
}

function toNum(value: number | { toNumber(): number }): number {
  return typeof value === 'number' ? value : value.toNumber();
}

@Injectable()
export class InsightsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async regenerate(currentUser: AuthenticatedUser): Promise<InsightItem[]> {
    const sims = await this.getOverviewData(currentUser);
    const quotes = await this.getCarrierData(currentUser);
    const routes = await this.getRouteData(currentUser);
    const rules = this.generateRules(sims, quotes, routes);
    const insights: InsightItem[] = [];

    for (const rule of rules) {
      const insight = await this.prisma.insight.create({
        data: {
          tenantId: currentUser.tenantId,
          type: rule.type,
          title: rule.title,
          description: rule.description,
          severity: rule.severity,
          metadata: rule.metadata as unknown as any,
          isRead: false,
        },
      });
      insights.push({
        id: insight.id,
        type: insight.type,
        title: insight.title,
        description: insight.description,
        severity: insight.severity,
        metadata: insight.metadata as Record<string, unknown> | null,
        isRead: insight.isRead,
        createdAt: insight.createdAt,
      });
    }
    return insights;
  }

  async list(currentUser: AuthenticatedUser) {
    return this.prisma.insight.findMany({
      where: { tenantId: currentUser.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  private async getOverviewData(currentUser: AuthenticatedUser) {
    return this.prisma.freightSimulation.findMany({
      where: { tenantId: currentUser.tenantId },
      include: { quotes: { select: { totalCost: true, isCheapest: true } } },
    });
  }

  private async getCarrierData(currentUser: AuthenticatedUser) {
    return this.prisma.simulationQuote.findMany({
      where: { simulation: { tenantId: currentUser.tenantId } },
      include: { carrier: { select: { id: true, name: true } } },
    });
  }

  private async getRouteData(currentUser: AuthenticatedUser) {
    return this.prisma.freightSimulation.findMany({
      where: { tenantId: currentUser.tenantId },
      include: { quotes: { select: { totalCost: true } } },
    });
  }

  private generateRules(
    sims: Awaited<ReturnType<InsightsService['getOverviewData']>>,
    quotes: Awaited<ReturnType<InsightsService['getCarrierData']>>,
    routes: Awaited<ReturnType<InsightsService['getRouteData']>>,
  ): InsightRule[] {
    const rules: InsightRule[] = [];
    if (sims.length === 0) return rules;

    let totalSavings = 0;
    for (const sim of sims) {
      const qList = sim.quotes;
      const cheapest = qList.reduce(
        (a, b) => (toNum(a.totalCost) <= toNum(b.totalCost) ? a : b),
      );
      const selected = qList.find((q) => q.isCheapest);
      if (selected && cheapest && toNum(cheapest.totalCost) < toNum(selected.totalCost)) {
        totalSavings += toNum(selected.totalCost) - toNum(cheapest.totalCost);
      }
    }
    if (totalSavings > 0) {
      rules.push({
        type: 'economy',
        title: 'Oportunidade de economia',
        description: `A alternativa mais econômica poderia reduzir seus custos em R$ ${Math.round(totalSavings).toLocaleString('pt-BR')} nas últimas ${sims.length} simulações.`,
        severity: totalSavings > 10000 ? InsightSeverity.HIGH : totalSavings > 1000 ? InsightSeverity.MEDIUM : InsightSeverity.LOW,
        metadata: { totalSavings, simulationCount: sims.length },
      });
    }

    if (quotes.length > 0) {
      const grouped = new Map<string, { total: number; count: number; name: string }>();
      for (const q of quotes) {
        const id = q.carrierId;
        const carrierObj = q.carrier as { name: string } | null;
        const name = carrierObj?.name || 'Desconhecida';
        const existing = grouped.get(id);
        if (existing) {
          existing.total += toNum(q.totalCost);
          existing.count++;
        } else {
          grouped.set(id, { total: toNum(q.totalCost), count: 1, name });
        }
      }
      let cheapestCarrier = '';
      let lowestAvg = Infinity;
      for (const [id, data] of grouped) {
        const avg = data.total / data.count;
        if (avg < lowestAvg) {
          lowestAvg = avg;
          cheapestCarrier = `${data.name} (${id})`;
        }
      }
      rules.push({
        type: 'carrier',
        title: 'Transportadora mais econômica',
        description: `A transportadora ${cheapestCarrier} apresentou custo médio ${Math.round(lowestAvg).toLocaleString('pt-BR')} nas rotas analisadas.`,
        severity: InsightSeverity.LOW,
        metadata: { carrierId: cheapestCarrier, avgCost: lowestAvg },
      });
    }

    if (routes.length > 0) {
      const routeCounts = new Map<string, number>();
      for (const r of routes) {
        const key = `${r.origin}|${r.destination}`;
        routeCounts.set(key, (routeCounts.get(key) ?? 0) + 1);
      }
      const total = routes.length;
      let maxRoute = '';
      let maxCount = 0;
      for (const [key, count] of routeCounts) {
        if (count > maxCount) {
          maxCount = count;
          maxRoute = key;
        }
      }
      const pct = Math.round((maxCount / total) * 100);
      const [origin, destination] = maxRoute.split('|');
      rules.push({
        type: 'concentration',
        title: 'Concentração de rotas',
        description: `A rota ${origin} → ${destination} representa ${pct}% das suas simulações recentes.`,
        severity: pct > 30 ? InsightSeverity.MEDIUM : InsightSeverity.LOW,
        metadata: { origin, destination, percentage: pct, count: maxCount },
      });
    }

    const now = new Date();
    const fourWeeksAgo = new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000);
    const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
    const recentSims = sims.filter(
      (s) => new Date(s.createdAt) >= fourWeeksAgo,
    );
    const previousSims = sims.filter(
      (s) => new Date(s.createdAt) >= eightWeeksAgo && new Date(s.createdAt) < fourWeeksAgo,
    );
    if (recentSims.length > 0 && previousSims.length > 0) {
      const recentAvg = this.avgQuoteCost(recentSims);
      const previousAvg = this.avgQuoteCost(previousSims);
      if (previousAvg > 0) {
        const change = ((recentAvg - previousAvg) / previousAvg) * 100;
        if (Math.abs(change) > 1) {
          rules.push({
            type: 'trend',
            title: 'Tendência de custo',
            description: `O custo médio de frete ${change < 0 ? 'caiu' : 'subiu'} ${Math.abs(Math.round(change))}% nas últimas quatro semanas (${Math.round(recentAvg).toLocaleString('pt-BR')} vs ${Math.round(previousAvg).toLocaleString('pt-BR')}).`,
            severity: InsightSeverity.LOW,
            metadata: { recentAvg, previousAvg, changePercent: Math.round(change) },
          });
        }
      }
    }

    return rules;
  }

  private avgQuoteCost(sims: Awaited<ReturnType<InsightsService['getOverviewData']>>): number {
    let total = 0;
    let count = 0;
    for (const sim of sims) {
      for (const q of sim.quotes) {
        total += toNum(q.totalCost);
        count++;
      }
    }
    return count > 0 ? total / count : 0;
  }
}
