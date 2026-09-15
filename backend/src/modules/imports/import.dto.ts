import { z } from 'zod';

export const importFileSchema = z.object({
  filename: z.string().min(1).max(255),
  type: z.enum(['CUSTOMERS', 'CARRIERS', 'SIMULATIONS']),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
});

export type ImportFileDto = z.infer<typeof importFileSchema>;
export type CreateImportDto = ImportFileDto;

export const listImportsQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
});

export type ListImportsQueryDto = z.infer<typeof listImportsQuerySchema>;
