import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { RedisService } from '../database/redis.service.js';
import { QUEUE_NAMES } from './queue.constants.js';
import { ImportWorker } from '../modules/imports/import.worker.js';

@Injectable()
export class ImportProcessor implements OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ImportWorker) private readonly importWorker: ImportWorker,
  ) {}

  async onModuleInit() {
    const client = this.redis.getClient();
    if (client.status !== 'ready') {
      await client.connect();
    }

    this.queue = new Queue(QUEUE_NAMES.IMPORT_PROCESSING, {
      connection: client,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    });

    this.worker = new Worker(
      QUEUE_NAMES.IMPORT_PROCESSING,
      async (job: Job) => {
        const data = job.data as { importId: string; tenantId: string };
        await this.importWorker.process(data.importId, data.tenantId);
      },
      { connection: client },
    );

    this.worker.on('completed', (job) => {
      // Job completed
    });

    this.worker.on('failed', (job, err) => {
      // Job failed
    });
  }

  async addImportJob(data: {
    importId: string;
    tenantId: string;
    userId?: string;
    filename: string;
    type: string;
    filePath: string;
    mimeType: string;
    sizeBytes: number;
  }) {
    if (!this.queue) return;
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
    if (this.queue) {
      await this.queue.close();
    }
  }
}
