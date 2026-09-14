import { Controller, Get, Query } from '@nestjs/common';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import {
  PaginationQueryDto,
  toPaginatedResponse,
} from '../../common/http/pagination.js';
import { PrismaService } from '../../database/prisma.service.js';

class AuditQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AuditQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      tenantId: user.tenantId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);
    return toPaginatedResponse(logs, total, page, limit);
  }
}
