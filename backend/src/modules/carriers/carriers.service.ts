import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { toPaginatedResponse } from '../../common/http/pagination.js';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditAction } from '../audit/audit-action.js';
import { AuditService, type AuditContext } from '../audit/audit.service.js';
import {
  CreateCarrierDto,
  ListCarriersQueryDto,
  UpdateCarrierDto,
} from './carrier.dto.js';
import { toCarrierResponse } from './carrier.presenter.js';

@Injectable()
export class CarriersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(currentUser: AuthenticatedUser, query: ListCarriersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      tenantId: currentUser.tenantId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { document: { contains: query.search } },
            ],
          }
        : {}),
      ...(query.active !== undefined ? { active: query.active } : {}),
    };
    const [total, carriers] = await Promise.all([
      this.prisma.carrier.count({ where }),
      this.prisma.carrier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return toPaginatedResponse(
      carriers.map(toCarrierResponse),
      total,
      page,
      limit,
    );
  }

  async findById(currentUser: AuthenticatedUser, id: string) {
    const carrier = await this.prisma.carrier.findFirst({
      where: { id, tenantId: currentUser.tenantId },
    });
    if (!carrier) {
      throw new NotFoundException({
        code: 'CARRIER_NOT_FOUND',
        message: 'Transportadora não encontrada.',
      });
    }
    return toCarrierResponse(carrier);
  }

  async create(
    currentUser: AuthenticatedUser,
    dto: CreateCarrierDto,
    auditCtx: AuditContext,
  ) {
    const carrier = await this.prisma.carrier.create({
      data: {
        tenantId: currentUser.tenantId,
        name: dto.name.trim(),
        document: dto.document?.trim() ?? null,
        email: dto.email?.trim() ?? null,
        phone: dto.phone?.trim() ?? null,
        baseFee: dto.baseFee,
        pricePerKg: dto.pricePerKg,
        pricePerKm: dto.pricePerKm,
        riskPercent: dto.riskPercent,
        cubingFactor: dto.cubingFactor ?? 6000,
        active: true,
      },
    });
    await this.audit.log({
      ...auditCtx,
      tenantId: currentUser.tenantId,
      userId: currentUser.id,
      action: AuditAction.CARRIER_CREATED,
      entity: 'Carrier',
      entityId: carrier.id,
      metadata: { name: carrier.name, pricePerKg: carrier.pricePerKg },
    });
    return toCarrierResponse(carrier);
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateCarrierDto,
    auditCtx: AuditContext,
  ) {
    const carrier = await this.prisma.carrier.findFirst({
      where: { id, tenantId: currentUser.tenantId },
    });
    if (!carrier) {
      throw new NotFoundException({
        code: 'CARRIER_NOT_FOUND',
        message: 'Transportadora não encontrada.',
      });
    }
    const updated = await this.prisma.carrier.update({
      where: { id: carrier.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.document !== undefined
          ? { document: dto.document.trim() ?? null }
          : {}),
        ...(dto.email !== undefined ? { email: dto.email.trim() ?? null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() ?? null } : {}),
        ...(dto.baseFee !== undefined ? { baseFee: dto.baseFee } : {}),
        ...(dto.pricePerKg !== undefined ? { pricePerKg: dto.pricePerKg } : {}),
        ...(dto.pricePerKm !== undefined ? { pricePerKm: dto.pricePerKm } : {}),
        ...(dto.riskPercent !== undefined ? { riskPercent: dto.riskPercent } : {}),
        ...(dto.cubingFactor !== undefined ? { cubingFactor: dto.cubingFactor } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
    await this.audit.log({
      ...auditCtx,
      tenantId: currentUser.tenantId,
      userId: currentUser.id,
      action: AuditAction.CARRIER_UPDATED,
      entity: 'Carrier',
      entityId: updated.id,
      metadata: { name: updated.name, active: updated.active },
    });
    return toCarrierResponse(updated);
  }

  async remove(
    currentUser: AuthenticatedUser,
    id: string,
    auditCtx: AuditContext,
  ) {
    const carrier = await this.prisma.carrier.findFirst({
      where: { id, tenantId: currentUser.tenantId },
    });
    if (!carrier) {
      throw new NotFoundException({
        code: 'CARRIER_NOT_FOUND',
        message: 'Transportadora não encontrada.',
      });
    }
    const hasSimulations = await this.prisma.freightSimulation.findFirst({
      where: { tenantId: currentUser.tenantId, selectedCarrierId: carrier.id },
      select: { id: true },
    });
    if (hasSimulations) {
      throw new ForbiddenException({
        code: 'CARRIER_IN_USE',
        message: 'Transportadora está vinculada a simulações e não pode ser removida.',
      });
    }
    await this.prisma.carrier.delete({ where: { id: carrier.id } });
    await this.audit.log({
      ...auditCtx,
      tenantId: currentUser.tenantId,
      userId: currentUser.id,
      action: AuditAction.CARRIER_DELETED,
      entity: 'Carrier',
      entityId: carrier.id,
      metadata: { name: carrier.name },
    });
    return { deleted: true };
  }
}
