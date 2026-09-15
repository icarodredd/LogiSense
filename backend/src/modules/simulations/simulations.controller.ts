import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
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
  CreateSimulationDto,
  ListSimulationsQueryDto,
} from './simulation.dto.js';
import { SimulationsService } from './simulations.service.js';

@Controller('simulations')
export class SimulationsController {
  constructor(
    @Inject(SimulationsService) private readonly simulations: SimulationsService,
  ) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSimulationsQueryDto,
  ) {
    return this.simulations.list(user, query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  findById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.simulations.findById(user, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSimulationDto,
    @Req() req: Request,
  ) {
    return this.simulations.create(user, dto, extractAuditContext(req));
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.simulations.remove(user, id);
  }
}
