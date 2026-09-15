import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/http/pagination.js';

export enum ImportTypeValue {
  CUSTOMERS = 'CUSTOMERS',
  CARRIERS = 'CARRIERS',
  SIMULATIONS = 'SIMULATIONS',
}

export enum ImportStatusValue {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export class CreateImportDto {
  @IsEnum(ImportTypeValue)
  type!: ImportTypeValue;
}

export class ListImportsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ImportStatusValue)
  status?: ImportStatusValue;
}

export const IMPORT_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const IMPORT_ALLOWED_EXTENSIONS = ['.csv', '.xlsx'] as const;

export interface ImportFileMeta {
  originalName: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: number;
  type: ImportTypeValue;
}
