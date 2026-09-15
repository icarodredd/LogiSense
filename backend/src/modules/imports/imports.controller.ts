import { Controller, Get, Post, Param, Body, Query, Req, UseInterceptors, Inject } from '@nestjs/common';
import { Request } from 'express';
import type { CreateImportDto, ListImportsQueryDto } from './import.dto.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { extractAuditContext } from '../audit/audit-context.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportsService } from './imports.service.js';

@Controller('imports')
export class ImportsController {
  constructor(
    @Inject(ImportsService) private readonly imports: ImportsService,
  ) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListImportsQueryDto,
  ) {
    return this.imports.list(user, query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  findById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.imports.findById(user, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @UseInterceptors(FileInterceptor('file'))
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateImportDto,
    @Req() req: Request & { file?: { originalname: string; mimetype: string; size: number } },
  ) {
    const file = req.file!;
    return this.imports.create(
      user,
      { filename: file.originalname, type: dto.type, sizeBytes: file.size },
      `/uploads/${file.originalname}`,
      extractAuditContext(req),
    );
  }
}
