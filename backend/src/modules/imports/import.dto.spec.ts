import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ListImportsQueryDto } from './import.dto.js';

describe('ListImportsQueryDto', () => {
  it('converte parâmetros numéricos da query string antes da validação', async () => {
    const query = plainToInstance(ListImportsQueryDto, {
      page: '2',
      limit: '20',
    });

    expect(query.page).toBe(2);
    expect(query.limit).toBe(20);
    await expect(validate(query)).resolves.toHaveLength(0);
  });

  it('mantém os limites da paginação', async () => {
    const query = plainToInstance(ListImportsQueryDto, {
      limit: '101',
    });

    const errors = await validate(query);
    expect(errors.find((error) => error.property === 'limit')?.constraints).toEqual(
      expect.objectContaining({ max: expect.any(String) }),
    );
  });
});
