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
  CreateCustomerDto,
  ListCustomersQueryDto,
  UpdateCustomerDto,
} from './customer.dto.js';
import { CustomersService } from './customers.service.js';

@Controller('customers')
export class CustomersController {
  constructor(
    @Inject(CustomersService) private readonly customers: CustomersService,
  ) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCustomersQueryDto,
  ) {
    return this.customers.list(user, query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  findById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.customers.findById(user, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerDto,
    @Req() req: Request,
  ) {
    return this.customers.create(user, dto, extractAuditContext(req));
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @Req() req: Request,
  ) {
    return this.customers.update(user, id, dto, extractAuditContext(req));
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.customers.remove(user, id, extractAuditContext(req));
  }
}
