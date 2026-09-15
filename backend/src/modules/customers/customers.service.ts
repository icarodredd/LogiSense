import {
  ConflictException,
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
import { CreateCustomerDto, ListCustomersQueryDto, UpdateCustomerDto } from './customer.dto.js';
import { toCustomerResponse } from './customer.presenter.js';

@Injectable()
export class CustomersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(currentUser: AuthenticatedUser, query: ListCustomersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      tenantId: currentUser.tenantId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { document: { contains: query.search } },
              { email: { contains: query.search } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, customers] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return toPaginatedResponse(
      customers.map(toCustomerResponse),
      total,
      page,
      limit,
    );
  }

  async findById(currentUser: AuthenticatedUser, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: currentUser.tenantId },
    });
    if (!customer) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Cliente não encontrado.',
      });
    }
    return toCustomerResponse(customer);
  }

  async create(
    currentUser: AuthenticatedUser,
    dto: CreateCustomerDto,
    auditCtx: AuditContext,
  ) {
    const existing = await this.prisma.customer.findFirst({
      where: {
        tenantId: currentUser.tenantId,
        document: dto.document ?? undefined,
      },
      select: { id: true },
    });
    if (existing && dto.document) {
      throw new ConflictException({
        code: 'DOCUMENT_TAKEN',
        message: 'Este documento já está em uso neste tenant.',
      });
    }
    const customer = await this.prisma.customer.create({
      data: {
        tenantId: currentUser.tenantId,
        name: dto.name.trim(),
        document: dto.document?.trim() ?? null,
        email: dto.email?.trim() ?? null,
        phone: dto.phone?.trim() ?? null,
        city: dto.city?.trim() ?? null,
        state: dto.state?.trim() ?? null,
      },
    });
    await this.audit.log({
      ...auditCtx,
      tenantId: currentUser.tenantId,
      userId: currentUser.id,
      action: AuditAction.CUSTOMER_CREATED,
      entity: 'Customer',
      entityId: customer.id,
      metadata: { name: customer.name, email: customer.email },
    });
    return toCustomerResponse(customer);
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateCustomerDto,
    auditCtx: AuditContext,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: currentUser.tenantId },
    });
    if (!customer) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Cliente não encontrado.',
      });
    }
    const updated = await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.document !== undefined
          ? { document: dto.document.trim() ?? null }
          : {}),
        ...(dto.email !== undefined ? { email: dto.email.trim() ?? null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() ?? null } : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() ?? null } : {}),
        ...(dto.state !== undefined ? { state: dto.state.trim() ?? null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
    await this.audit.log({
      ...auditCtx,
      tenantId: currentUser.tenantId,
      userId: currentUser.id,
      action: AuditAction.CUSTOMER_UPDATED,
      entity: 'Customer',
      entityId: updated.id,
      metadata: { name: updated.name, status: updated.status },
    });
    return toCustomerResponse(updated);
  }

  async remove(
    currentUser: AuthenticatedUser,
    id: string,
    auditCtx: AuditContext,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: currentUser.tenantId },
    });
    if (!customer) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Cliente não encontrado.',
      });
    }
    const hasSimulations = await this.prisma.freightSimulation.findFirst({
      where: { tenantId: currentUser.tenantId, customerId: customer.id },
      select: { id: true },
    });
    if (hasSimulations) {
      throw new ForbiddenException({
        code: 'CUSTOMER_IN_USE',
        message: 'Cliente possui simulações vinculadas e não pode ser removido.',
      });
    }
    await this.prisma.customer.delete({ where: { id: customer.id } });
    await this.audit.log({
      ...auditCtx,
      tenantId: currentUser.tenantId,
      userId: currentUser.id,
      action: AuditAction.CUSTOMER_DELETED,
      entity: 'Customer',
      entityId: customer.id,
      metadata: { name: customer.name },
    });
    return { deleted: true };
  }
}
