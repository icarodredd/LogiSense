import { describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service.js';

describe('AuditService', () => {
  it('remove secrets/tokens do metadata antes de persistir', async () => {
    const create = vi.fn().mockResolvedValue({});
    const service = new AuditService({ auditLog: { create } } as never);
    await service.log({
      tenantId: 't1',
      action: 'LOGIN',
      metadata: {
        method: 'password',
        refreshToken: 'nunca-logar',
        passwordHash: 'nunca-logar',
        authorization: 'nunca-logar',
      },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: { method: 'password' },
      }),
    });
  });
});
