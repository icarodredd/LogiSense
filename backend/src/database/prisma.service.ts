import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { AppLogger } from '../common/logger/app-logger.service.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    super({
      datasourceUrl: config.get<string>('databaseUrl', { infer: true }),
      log: ['warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to MySQL', 'PrismaService');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
