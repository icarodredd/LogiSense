import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { AppLogger } from '../common/logger/app-logger.service.js';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(AppLogger) private readonly logger: AppLogger,
  ) {
    const url = config.get<string>('redisUrl', { infer: true });
    this.client = new Redis(url ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
    this.client.on('error', (error: unknown) => {
      this.logger.warn(`Redis error: ${String(error)}`, 'RedisService');
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.ping();
      this.logger.log('Connected to Redis', 'RedisService');
    } catch (error) {
      this.logger.warn(`Redis unavailable: ${String(error)}`, 'RedisService');
    }
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch {
      throw new Error('Redis connection is closed.');
    }
  }

  async onModuleDestroy() {
    try {
      if (this.client.status !== 'end' && this.client.status !== 'close') {
        await this.client.disconnect();
      }
    } catch {
      // ignore cleanup errors on shutdown
    }
  }
}
