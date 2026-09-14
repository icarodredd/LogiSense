import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { AppLogger } from '../common/logger/app-logger.service.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(config: ConfigService, logger: AppLogger) {
    const url = config.get<string>('redisUrl', { infer: true });
    this.client = new Redis(url ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
    this.client.on('error', (error: unknown) => {
      logger.warn(`Redis error: ${String(error)}`, 'RedisService');
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async onModuleDestroy() {
    if (this.client.status !== 'end') {
      this.client.disconnect();
    }
  }
}
