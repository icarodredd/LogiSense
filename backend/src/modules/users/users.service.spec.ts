import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { UsersService } from './users.service.js';

const me: AuthenticatedUser = {
  id: 'me-id',
  tenantId: 'tenant-1',
  email: 'admin@acme',
  role: 'ADMIN',
};

const auditCtx = { ip: '127.0.0.1' };

function setup(prismaUser: Record<string, unknown>) {
  const prisma = {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  const audit = { log: vi.fn().mockResolvedValue(undefined) };
  const service = new UsersService(prisma as never, audit as never);
  return { service, prisma, audit, prismaUser };
}

describe('UsersService — isolamento por tenant', () => {
  it('list filtra sempre pelo tenant autenticado', async () => {
    const { service, prisma } = setup({});
    prisma.user.count.mockResolvedValue(0);
    prisma.user.findMany.mockResolvedValue([]);
    await service.list(me, {});
    expect(prisma.user.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) }),
    );
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) }),
    );
  });

  it('findById nunca retorna usuário de outro tenant', async () => {
    const { service, prisma } = setup({});
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.findById(me, 'outro-tenant-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'outro-tenant-id', tenantId: 'tenant-1' },
    });
  });

  it('nunca expõe passwordHash na resposta', async () => {
    const { service, prisma } = setup({});
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      tenantId: 'tenant-1',
      name: 'A',
      email: 'a@a.com',
      passwordHash: 'hash-secreto',
      role: 'OPERATOR',
      status: 'ACTIVE',
      mfaEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await service.findById(me, 'u1');
    expect(result).not.toHaveProperty('passwordHash');
  });
});

describe('UsersService — regras', () => {
  it('create normaliza o e-mail e acusa conflito com EMAIL_TAKEN', async () => {
    const { service, prisma } = setup({});
    prisma.user.findUnique.mockResolvedValue({ id: 'x' });
    await expect(
      service.create(me, { name: 'N', email: 'A@A.com', password: 'Senha123' }, auditCtx),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { tenantId_email: { tenantId: 'tenant-1', email: 'a@a.com' } },
      select: { id: true },
    });
  });

  it('update impede trocar o próprio perfil e loga ROLE_CHANGED', async () => {
    const { service, prisma, audit } = setup({});
    prisma.user.findFirst.mockResolvedValue({
      id: 'me-id',
      tenantId: 'tenant-1',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    await expect(
      service.update(me, 'me-id', { role: 'OPERATOR' }, auditCtx),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findFirst.mockResolvedValue({
      id: 'other',
      tenantId: 'tenant-1',
      role: 'OPERATOR',
      status: 'ACTIVE',
    });
    prisma.user.update.mockResolvedValue({
      id: 'other',
      tenantId: 'tenant-1',
      role: 'MANAGER',
      status: 'ACTIVE',
    });
    await service.update(me, 'other', { role: 'MANAGER' }, auditCtx);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ROLE_CHANGED' }),
    );
  });

  it('remove impede auto-exclusão e excluir o último admin', async () => {
    const { service, prisma } = setup({});
    prisma.user.findFirst.mockResolvedValue({ id: 'me-id', role: 'ADMIN' });
    await expect(service.remove(me, 'me-id', auditCtx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    prisma.user.findFirst.mockResolvedValue({ id: 'admin2', role: 'ADMIN' });
    prisma.user.count.mockResolvedValue(1);
    await expect(service.remove(me, 'admin2', auditCtx)).rejects.toThrowError(
      expect.objectContaining({ message: expect.stringContaining('último administrador') }),
    );
  });
});
