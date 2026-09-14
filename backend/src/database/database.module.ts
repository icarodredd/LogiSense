import { Global, Module } from '@nestjs/common';
import { AppLogger } from '../common/logger/app-logger.service.js';
import { PrismaService } from './prisma.service.js';
import { RedisService } from './redis.service.js';

@Global()
@Module({
  providers: [AppLogger, PrismaService, RedisService],
  exports: [AppLogger, PrismaService, RedisService],
})
export class DatabaseModule {}
