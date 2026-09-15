import { Module } from '@nestjs/common';
import { RedisService } from '../database/redis.service.js';
import { QUEUE_NAMES } from './queue.constants.js';
import { ImportProcessor } from './import.processor.js';
import { ImportWorker } from '../modules/imports/import.worker.js';
import { AuditModule } from '../modules/audit/audit.module.js';
import { WebSocketModule } from '../websocket/websocket.module.js';
import { Queue } from 'bullmq';

@Module({
  imports: [AuditModule, WebSocketModule],
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
  exports: [ImportProcessor],
})
export class QueueModule {}
