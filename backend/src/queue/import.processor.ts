import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';
import { RedisService } from '../database/redis.service.js';
import { QUEUE_NAMES } from './queue.constants.js';
import { ImportWorker } from '../modules/imports/import.worker.js';
import type { ImportType as PrismaImportType } from '@prisma/client';
import { join } from 'node:path';
import type { AuditContext } from '../modules/audit/audit.service.js';
import { AppLogger } from '../common/logger/app-logger.service.js';

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

export const IMPORT_UPLOAD_DIR = join(process.cwd(), 'uploads', 'imports');

@Injectable()
export class ImportProcessor implements OnModuleInit, OnModuleDestroy {
  readonly uploadDir = IMPORT_UPLOAD_DIR;
  private worker: Worker | null = null;

  constructor(
    @Inject('IMPORT_QUEUE') private readonly queue: Queue,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ImportWorker) private readonly importWorker: ImportWorker,
    @Inject(AppLogger) private readonly logger: AppLogger,
  ) {}

  async onModuleInit() {
    const connection = this.redis.getClient();
    try {
      this.worker = new Worker(
        QUEUE_NAMES.IMPORT_PROCESSING,
        async (job: Job<ImportJobData>) => {
          const data = job.data;
          await this.importWorker.process(
            data.importId,
            data.tenantId,
            data.filePath,
            data.mimeType,
            data.type as PrismaImportType,
            data.auditCtx ?? {},
            data.userId,
          );
        },
        { connection, concurrency: 2 },
      );
    } catch (error) {
      this.logger.warn(`Redis unavailable for queue worker: ${String(error)}`, 'ImportProcessor');
    }

    this.worker?.on('failed', (job, err) => {
      if (!job) return;
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
      await this.worker.close().catch(() => undefined);
    }
    try {
      await this.queue.close();
    } catch {
      // ignore queue close errors on shutdown
    }
  }
}
