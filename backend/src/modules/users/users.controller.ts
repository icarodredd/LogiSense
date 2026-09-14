import {
  Body,
  Controller,
  Delete,
  Get,
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
import { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from './user.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListUsersQueryDto,
  ) {
    return this.users.list(user, query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  findById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.users.findById(user, id);
  }

  @Post()
  @Roles('ADMIN')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUserDto,
    @Req() req: Request,
  ) {
    return this.users.create(user, dto, extractAuditContext(req));
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
  ) {
    return this.users.update(user, id, dto, extractAuditContext(req));
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.users.remove(user, id, extractAuditContext(req));
  }
}
