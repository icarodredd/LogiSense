import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { extractAuditContext } from '../audit/audit-context.js';
import {
  CreateCarrierDto,
  ListCarriersQueryDto,
  UpdateCarrierDto,
} from './carrier.dto.js';
import { CarriersService } from './carriers.service.js';

@Controller('carriers')
export class CarriersController {
  constructor(
    @Inject(CarriersService) private readonly carriers: CarriersService,
  ) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCarriersQueryDto,
  ) {
    return this.carriers.list(user, query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  findById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.carriers.findById(user, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCarrierDto,
    @Req() req: Request,
  ) {
    return this.carriers.create(user, dto, extractAuditContext(req));
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCarrierDto,
    @Req() req: Request,
  ) {
    return this.carriers.update(user, id, dto, extractAuditContext(req));
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.carriers.remove(user, id, extractAuditContext(req));
  }
}
