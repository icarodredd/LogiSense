import { describe, expect, it, vi } from 'vitest';
import { WebSocketGateway } from './websocket.gateway.js';

const user = { id: 'user-1', tenantId: 'tenant-1', email: 'user@example.com', role: 'OPERATOR' };

function makeGateway(canJoin = true) {
  const join = vi.fn();
  const gateway = new WebSocketGateway(
    { log: vi.fn(), warn: vi.fn() } as never,
    { extractSocketUser: vi.fn().mockReturnValue(user) } as never,
    { canJoin: vi.fn().mockResolvedValue(canJoin) } as never,
  );
  return { gateway, join };
}

describe('WebSocketGateway', () => {
  it('permite entrar somente na room autorizada do import', async () => {
    const { gateway, join } = makeGateway();
    const result = await gateway.handleJoinImport(
      { importId: 'import-1' },
      { id: 'socket-1', join } as never,
    );

    expect(result).toEqual({ ok: true });
    expect(join).toHaveBeenCalledWith('import-import-1');
  });

  it('rejeita import de outro tenant', async () => {
    const { gateway, join } = makeGateway(false);
    const result = await gateway.handleJoinImport(
      { importId: 'import-from-other-tenant' },
      { id: 'socket-1', join } as never,
    );

    expect(result).toEqual({ ok: false, error: 'FORBIDDEN' });
    expect(join).not.toHaveBeenCalled();
  });

  it('emite progresso para a room específica do import', () => {
    const { gateway } = makeGateway();
    const emit = vi.fn();
    gateway.server = {
      to: vi.fn().mockReturnValue({ emit }),
    } as never;

    gateway.emitImportProgress('import-1', {
      status: 'PROCESSING',
      processed: 5,
      total: 10,
      percentage: 50,
    });

    expect(gateway.server.to).toHaveBeenCalledWith('import-import-1');
    expect(emit).toHaveBeenCalledWith('import-progress', expect.objectContaining({
      status: 'PROCESSING',
      percentage: 50,
    }));
  });
});
