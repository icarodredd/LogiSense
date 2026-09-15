import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { WsUser } from './ws-auth.service.js';

@Injectable()
export class ImportRoomService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * A sala é por importId, então a posse do import é a proteção contra
   * eavesdropping entre tenants (AGENTS.md §7 — isolamento).
   */
  async canJoin(user: WsUser, importId: string): Promise<boolean> {
    const imp = await this.prisma.import.findFirst({
      where: { id: importId, tenantId: user.tenantId },
      select: { id: true },
    });
    return imp !== null;
  }
}
