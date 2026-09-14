import { Controller, Get, Inject } from '@nestjs/common';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { PrismaService } from '../../database/prisma.service.js';

@Controller('tenants')
export class TenantsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get('me')
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { id: true, name: true, slug: true, createdAt: true },
    });
  }
}
