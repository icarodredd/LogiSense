import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { toPaginatedResponse } from '../../common/http/pagination.js';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditAction } from '../audit/audit-action.js';
import { AuditService, type AuditContext } from '../audit/audit.service.js';
import { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from './user.dto.js';
import { toUserResponse } from './user.presenter.js';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async list(currentUser: AuthenticatedUser, query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      tenantId: currentUser.tenantId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { email: { contains: query.search } },
            ],
          }
        : {}),
    };
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return toPaginatedResponse(users.map(toUserResponse), total, page, limit);
  }

  async findById(currentUser: AuthenticatedUser, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId: currentUser.tenantId },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Usuário não encontrado.',
      });
    }
    return toUserResponse(user);
  }

  async create(
    currentUser: AuthenticatedUser,
    dto: CreateUserDto,
    auditCtx: AuditContext,
  ) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: currentUser.tenantId, email } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: 'Este e-mail já está em uso neste tenant.',
      });
    }
    const user = await this.prisma.user.create({
      data: {
        tenantId: currentUser.tenantId,
        name: dto.name.trim(),
        email,
        passwordHash: await this.hashPassword(dto.password),
        role: dto.role ?? 'OPERATOR',
      },
    });
    await this.audit.log({
      ...auditCtx,
      tenantId: currentUser.tenantId,
      userId: currentUser.id,
      action: AuditAction.USER_CREATED,
      entity: 'User',
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });
    return toUserResponse(user);
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateUserDto,
    auditCtx: AuditContext,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId: currentUser.tenantId },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Usuário não encontrado.',
      });
    }
    if (id === currentUser.id && dto.role && dto.role !== user.role) {
      throw new ForbiddenException({
        code: 'CANNOT_CHANGE_OWN_ROLE',
        message: 'Você não pode alterar o próprio perfil de acesso.',
      });
    }
    if (id === currentUser.id && dto.status === 'SUSPENDED') {
      throw new ForbiddenException({
        code: 'CANNOT_SUSPEND_SELF',
        message: 'Você não pode suspender a própria conta.',
      });
    }
    const roleChanged = dto.role !== undefined && dto.role !== user.role;
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
      },
    });
    await this.audit.log({
      ...auditCtx,
      tenantId: currentUser.tenantId,
      userId: currentUser.id,
      action: roleChanged ? AuditAction.ROLE_CHANGED : AuditAction.USER_UPDATED,
      entity: 'User',
      entityId: updated.id,
      metadata: roleChanged
        ? { from: user.role, to: updated.role }
        : { status: updated.status },
    });
    return toUserResponse(updated);
  }

  async remove(
    currentUser: AuthenticatedUser,
    id: string,
    auditCtx: AuditContext,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId: currentUser.tenantId },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Usuário não encontrado.',
      });
    }
    if (id === currentUser.id) {
      throw new ForbiddenException({
        code: 'CANNOT_DELETE_SELF',
        message: 'Você não pode remover a própria conta.',
      });
    }
    if (user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({
        where: { tenantId: currentUser.tenantId, role: 'ADMIN', status: 'ACTIVE' },
      });
      if (adminCount <= 1) {
        throw new ForbiddenException({
          code: 'CANNOT_DELETE_LAST_ADMIN',
          message: 'Não é possível remover o último administrador do tenant.',
        });
      }
    }
    await this.prisma.user.delete({ where: { id: user.id } });
    await this.audit.log({
      ...auditCtx,
      tenantId: currentUser.tenantId,
      userId: currentUser.id,
      action: AuditAction.USER_DELETED,
      entity: 'User',
      entityId: user.id,
      metadata: { email: user.email },
    });
    return { deleted: true };
  }
}
