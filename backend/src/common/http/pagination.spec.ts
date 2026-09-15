import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { getPagination, PaginationQueryDto } from './pagination.js';

describe('PaginationQueryDto', () => {
  it('converte query strings numéricas para números', async () => {
    const query = plainToInstance(PaginationQueryDto, {
      page: '2',
      limit: '20',
    });

    expect(query.page).toBe(2);
    expect(query.limit).toBe(20);
    await expect(validate(query)).resolves.toHaveLength(0);
  });

  it('usa defaults quando os parâmetros são omitidos', async () => {
    const query = plainToInstance(PaginationQueryDto, {});

    expect(query.page).toBe(1);
    expect(query.limit).toBe(20);
    await expect(validate(query)).resolves.toHaveLength(0);
  });

  it('rejeita valores inválidos antes de chegar ao Prisma', async () => {
    const query = plainToInstance(PaginationQueryDto, {
      page: 'abc',
      limit: '101',
    });

    const errors = await validate(query);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['page', 'limit']),
    );
  });

  it('normaliza valores string mesmo quando o pipe não transformou o DTO', () => {
    expect(getPagination({ page: '2', limit: '20' } as never)).toEqual({
      page: 2,
      limit: 20,
    });
  });

  it('rejeita paginação inválida no service', () => {
    expect(() => getPagination({ page: '0', limit: '101' } as never)).toThrow(
      'O parâmetro page',
    );
  });
});
