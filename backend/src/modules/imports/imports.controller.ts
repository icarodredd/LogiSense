import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseInterceptors,
  Inject,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { diskStorage } from 'multer';
import { CreateImportDto, ListImportsQueryDto } from './import.dto.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { extractAuditContext } from '../audit/audit-context.js';
import { ImportsService } from './imports.service.js';
import { IMPORT_ALLOWED_EXTENSIONS, IMPORT_MAX_SIZE_BYTES } from './import.dto.js';
import { IMPORT_UPLOAD_DIR } from '../../queue/import.processor.js';

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

  @Post(':id/retry')
    @Roles('ADMIN', 'MANAGER')
    retry(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
      return this.imports.retry(user, id);
    }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, IMPORT_UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          const unique = `${randomUUID()}${extname(file.originalname).toLowerCase()}`;
          cb(null, unique);
        },
      }),
      limits: { fileSize: IMPORT_MAX_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!IMPORT_ALLOWED_EXTENSIONS.includes(ext as '.csv' | '.xlsx')) {
          cb(
            new BadRequestException({
              code: 'IMPORT_INVALID_FILE_TYPE',
              message: 'A extensão do arquivo deve ser .csv ou .xlsx.',
            }),
            false,
          );
          return;
        }
        const validMimeTypes = ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'];
        if (file.mimetype && !validMimeTypes.includes(file.mimetype)) {
          cb(
            new BadRequestException({
              code: 'IMPORT_INVALID_MIME_TYPE',
              message: `Tipo de conteúdo não suportado: ${file.mimetype}`,
            }),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateImportDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'IMPORT_FILE_REQUIRED',
        message: 'Arquivo é obrigatório (campo "file").',
      });
    }
    return this.imports.create(
      user,
      {
        originalName: file.originalname,
        storedPath: file.path,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        type: dto.type,
      },
      extractAuditContext(req),
    );
  }
}
