import { PrismaService } from '../../database/prisma.service.js';
import { WebSocketGateway } from '../../websocket/websocket.gateway.js';
import { ImportStatus } from '@prisma/client';

@Injectable()
export class ImportWorker {
  constructor(
    @Inject(WebSocketGateway) private readonly ws: WebSocketGateway,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async process(importId: string, tenantId: string) {
    const imp = await this.prisma.import.findUnique({
      where: { id: importId },
    });
    if (!imp || imp.tenantId !== tenantId) return;

    try {
      this.ws.emitImportProgress(importId, {
        status: 'PROCESSING',
        processed: 0,
        total: 0,
        percentage: 0,
      });

      const totalRows = 1500;
      const batchSize = 100;
      let processed = 0;

      for (let i = 0; i < totalRows; i += batchSize) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        processed += batchSize;
        const percentage = Math.round((processed / totalRows) * 100);

        this.ws.emitImportProgress(importId, {
          status: 'PROCESSING',
          processed,
          total: totalRows,
          percentage,
        });

        await this.prisma.import.update({
          where: { id: importId },
          data: { processedRows: processed },
        });
      }

      await this.prisma.import.update({
        where: { id: importId },
        data: {
          status: ImportStatus.COMPLETED,
          totalRows,
          processedRows: totalRows,
          completedAt: new Date(),
        },
      });

      this.ws.emitImportProgress(importId, {
        status: 'COMPLETED',
        processed: totalRows,
        total: totalRows,
        percentage: 100,
      });
    } catch (error) {
      await this.prisma.import.update({
        where: { id: importId },
        data: {
          status: ImportStatus.FAILED,
          errorMessage: String(error instanceof Error ? error.message : error),
          completedAt: new Date(),
        },
      });

      this.ws.emitImportProgress(importId, {
        status: 'FAILED',
        processed: 0,
        total: 0,
        percentage: 0,
        errorMessage: String(error instanceof Error ? error.message : error),
      });
    }
  }
}
