import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { RedisService } from '../../database/redis.service.js';

interface DependencyCheck {
  status: 'up' | 'down';
  latencyMs: number;
  detail?: string;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  service: string;
  uptimeSeconds: number;
  timestamp: string;
  checks: {
    mysql: DependencyCheck;
    redis: DependencyCheck;
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthReport> {
    const [mysql, redis] = await Promise.all([
      this.checkMysql(),
      this.checkRedis(),
    ]);
    return {
      status: mysql.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded',
      service: 'logisense-api',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: { mysql, redis },
    };
  }

  private async checkMysql(): Promise<DependencyCheck> {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async checkRedis(): Promise<DependencyCheck> {
    const startedAt = Date.now();
    try {
      await this.redis.ping();
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
