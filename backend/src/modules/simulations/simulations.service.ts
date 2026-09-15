import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { getPagination, toPaginatedResponse } from '../../common/http/pagination.js';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditAction } from '../audit/audit-action.js';
import { AuditService, type AuditContext } from '../audit/audit.service.js';
import { FreightService } from '../freight/freight.service.js';
import { getRouteDistance } from './route-distances.js';
import { CreateSimulationDto, ListSimulationsQueryDto } from './simulation.dto.js';
import { toSimulationResponse } from './simulation.presenter.js';

@Injectable()
export class SimulationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(FreightService) private readonly freight: FreightService,
  ) {}

  async create(
    currentUser: AuthenticatedUser,
    dto: CreateSimulationDto,
    auditCtx: AuditContext,
  ) {
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: {
          id: dto.customerId,
          tenantId: currentUser.tenantId,
        },
        select: { id: true },
      });
      if (!customer) {
        throw new NotFoundException({
          code: 'CUSTOMER_NOT_FOUND',
          message: 'Cliente não encontrado.',
        });
      }
    }

    const distanceKm = getRouteDistance(dto.origin, dto.destination);
    if (distanceKm === null) {
      throw new NotFoundException({
        code: 'ROUTE_NOT_FOUND',
        message: 'Rota não catalogada.',
      });
    }

    const carriers = await this.prisma.carrier.findMany({
      where: { tenantId: currentUser.tenantId, active: true },
    });
    if (carriers.length === 0) {
      throw new NotFoundException({
        code: 'NO_CARRIERS',
        message: 'Nenhuma transportadora ativa neste tenant.',
      });
    }

    const pesoCubado =
      (dto.lengthCm * dto.widthCm * dto.heightCm) / 6000;
    const chargeableWeightKg = Math.max(dto.weightKg, pesoCubado);

    const quotesData = carriers.map((carrier) => {
      const quote = this.freight.calculate(carrier, {
        weightKg: dto.weightKg,
        lengthCm: dto.lengthCm,
        widthCm: dto.widthCm,
        heightCm: dto.heightCm,
        cargoValue: dto.cargoValue,
        distanceKm,
      });
      return {
        carrierId: carrier.id,
        freightCost: quote.freightCost,
        additionalFees: quote.additionalFees,
        totalCost: quote.totalCost,
        estimatedDays: quote.estimatedDays,
        isCheapest: false,
      };
    });

    const minTotal = Math.min(...quotesData.map((q) => q.totalCost));
    for (const q of quotesData) {
      if (q.totalCost === minTotal) q.isCheapest = true;
    }

    const simulation = await this.prisma.$transaction(async (tx) => {
      const sim = await tx.freightSimulation.create({
        data: {
          tenantId: currentUser.tenantId,
          userId: currentUser.id,
          customerId: dto.customerId ?? null,
          origin: dto.origin.trim(),
          destination: dto.destination.trim(),
          weightKg: dto.weightKg,
          lengthCm: dto.lengthCm,
          widthCm: dto.widthCm,
          heightCm: dto.heightCm,
          cargoValue: dto.cargoValue,
          distanceKm,
          volumetricWeightKg: Math.round(pesoCubado * 100) / 100,
          chargeableWeightKg: Math.round(chargeableWeightKg * 100) / 100,
        },
      });

      await tx.simulationQuote.createMany({
        data: quotesData.map((q) => ({
          ...q,
          simulationId: sim.id,
        })),
      });

      return sim;
    });

    await this.audit.log({
      ...auditCtx,
      tenantId: currentUser.tenantId,
      userId: currentUser.id,
      action: AuditAction.SIMULATION_CREATED,
      entity: 'FreightSimulation',
      entityId: simulation.id,
      metadata: {
        origin: simulation.origin,
        destination: simulation.destination,
        quoteCount: quotesData.length,
      },
    });

    const full = await this.prisma.freightSimulation.findUnique({
      where: { id: simulation.id },
      include: {
        quotes: { include: { carrier: { select: { id: true, name: true } } } },
      },
    });

    return toSimulationResponse(full as never);
  }

  async list(currentUser: AuthenticatedUser, query: ListSimulationsQueryDto) {
    const { page, limit } = getPagination(query);
    const where = {
      tenantId: currentUser.tenantId,
      ...(query.search
        ? {
            OR: [
              { origin: { contains: query.search } },
              { destination: { contains: query.search } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, simulations] = await Promise.all([
      this.prisma.freightSimulation.count({ where }),
      this.prisma.freightSimulation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          quotes: { include: { carrier: { select: { id: true, name: true } } } },
        },
      }),
    ]);
    return toPaginatedResponse(
      simulations.map(toSimulationResponse as never),
      total,
      page,
      limit,
    );
  }

  async findById(currentUser: AuthenticatedUser, id: string) {
    const simulation = await this.prisma.freightSimulation.findFirst({
      where: { id, tenantId: currentUser.tenantId },
      include: {
        quotes: { include: { carrier: { select: { id: true, name: true } } } },
      },
    });
    if (!simulation) {
      throw new NotFoundException({
        code: 'SIMULATION_NOT_FOUND',
        message: 'Simulação não encontrada.',
      });
    }
    return toSimulationResponse(simulation as never);
  }

  async remove(
    currentUser: AuthenticatedUser,
    id: string,
  ) {
    const simulation = await this.prisma.freightSimulation.findFirst({
      where: { id, tenantId: currentUser.tenantId },
    });
    if (!simulation) {
      throw new NotFoundException({
        code: 'SIMULATION_NOT_FOUND',
        message: 'Simulação não encontrada.',
      });
    }
    await this.prisma.freightSimulation.delete({ where: { id: simulation.id } });
    return { deleted: true };
  }

  async history(currentUser: AuthenticatedUser, query: ListSimulationsQueryDto) {
    const { page, limit } = getPagination(query);
    const where = {
      tenantId: currentUser.tenantId,
      ...(query.search
        ? {
            OR: [
              { origin: { contains: query.search } },
              { destination: { contains: query.search } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, simulations] = await Promise.all([
      this.prisma.freightSimulation.count({ where }),
      this.prisma.freightSimulation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          quotes: { include: { carrier: { select: { id: true, name: true } } } },
          customer: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
      }),
    ]);

    const items = simulations.map((sim) => {
      const quotes = sim.quotes.map((q) => ({
        id: q.id,
        carrierId: q.carrierId,
        carrierName: q.carrier.name,
        freightCost: q.freightCost,
        additionalFees: q.additionalFees,
        totalCost: q.totalCost,
        estimatedDays: q.estimatedDays,
        isCheapest: q.isCheapest,
      }));
      const cheapest = quotes.find((q) => q.isCheapest);
      const selected = sim.selectedCarrierId
        ? quotes.find((q) => q.carrierId === sim.selectedCarrierId)
        : null;
      return {
        id: sim.id,
        origin: sim.origin,
        destination: sim.destination,
        weightKg: sim.weightKg,
        cargoValue: sim.cargoValue,
        distanceKm: sim.distanceKm,
        status: sim.status,
        quotes,
        cheapestQuote: cheapest ?? null,
        selectedCarrierId: sim.selectedCarrierId,
        selectedQuote: selected ?? null,
        potentialSavings:
          cheapest && selected && cheapest.totalCost < selected.totalCost
            ? Number(selected.totalCost) - Number(cheapest.totalCost)
            : 0,
        customer: sim.customer ? { id: sim.customer.id, name: sim.customer.name } : null,
        user: sim.user ? { id: sim.user.id, name: sim.user.name } : null,
        createdAt: sim.createdAt,
      };
    });

    return { items, total, page, limit };
  }
}
