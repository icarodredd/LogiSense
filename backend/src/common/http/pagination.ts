import { Transform, Type } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? value : Number(value),
  )
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? value : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function getPagination(query: PaginationQueryDto): {
  page: number;
  limit: number;
} {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);

  if (!Number.isInteger(page) || page < 1) {
    throw new BadRequestException({
      code: 'INVALID_PAGE',
      message: 'O parâmetro page deve ser um inteiro maior ou igual a 1.',
    });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new BadRequestException({
      code: 'INVALID_LIMIT',
      message: 'O parâmetro limit deve ser um inteiro entre 1 e 100.',
    });
  }

  return { page, limit };
}

export function toPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}
