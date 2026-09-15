import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';
import { RedisService } from '../database/redis.service.js';
import { QUEUE_NAMES } from './queue.constants.js';
import { ImportWorker } from '../modules/imports/import.worker.js';
import { ImportType } from '@prisma/client';
import type { AuditContext } from '../modules/audit/audit.service.js';

export interface ImportJobData {
  importId: string;
  tenantId: string;
  userId?: string;
  filename: string;
  type: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  auditCtx?: Pick<AuditContext, 'ip' | 'userAgent' | 'requestId'>;
}

@Injectable()
export class ImportProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker | null = null;

  constructor(
    @Inject('IMPORT_QUEUE') private readonly queue: Queue,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ImportWorker) private readonly importWorker: ImportWorker,
  ) {}

  async onModuleInit() {
    const connection = this.redis.getClient();
    if (connection.status !== 'ready') {
      await connection.connect();
    }

    this.worker = new Worker(
      QUEUE_NAMES.IMPORT_PROCESSING,
      async (job: Job<ImportJobData>) => {
        const data = job.data;
        await this.importWorker.process(
          data.importId,
          data.tenantId,
          data.filePath,
          data.mimeType,
          data.type as ImportType,
          data.auditCtx ?? {},
          data.userId,
        );
      },
      { connection, concurrency: 2 },
    );

    this.worker.on('failed', (job, err) => {
      if (!job) return;
      // ImportWorker já marca o Import como FAILED no banco;
      // este log cobre falhas de enfileiramento/execução fora do worker.
      void this.importWorker.handleQueueFailure(
        job.data as ImportJobData,
        err,
      );
    });
  }

  async addImportJob(data: ImportJobData) {
    await this.queue.add('process-import', data, {
      jobId: data.importId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
    await this.queue.close();
  }
}
