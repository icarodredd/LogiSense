import { Module, DynamicModule } from '@nestjs/common';
import { RedisService } from '../database/redis.service.js';
import { QUEUE_NAMES } from './queue.constants.js';
import { ImportWorker } from '../modules/imports/import.worker.js';
import { ImportProcessor } from './import.processor.js';
import { Queue, Worker } from 'bullmq';

@Module({})
export class QueueModule {
  static forRoot(): DynamicModule {
    return {
      module: QueueModule,
      imports: [],
      providers: [
        {
          provide: 'IMPORT_QUEUE',
          useFactory: async (redis: RedisService) => {
            const client = redis.getClient();
            if (client.status !== 'ready') {
              await client.connect();
            }
            return new Queue(QUEUE_NAMES.IMPORT_PROCESSING, {
              connection: client,
              defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: true,
                removeOnFail: 1000,
              },
            });
          },
          inject: [RedisService],
        },
        ImportWorker,
        ImportProcessor,
      ],
      exports: ['IMPORT_QUEUE', ImportWorker, ImportProcessor],
    };
  }
}
