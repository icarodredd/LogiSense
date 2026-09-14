import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from './../src/database/prisma.service.js';
import { RedisService } from './../src/database/redis.service.js';
import { AppModule } from './../src/app.module.js';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: async () => [{ '1': 1 }] })
      .overrideProvider(RedisService)
      .useValue({ ping: async () => 'PONG' })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health retorna status ok com checks', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.checks.mysql.status).toBe('up');
    expect(response.body.checks.redis.status).toBe('up');
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('GET /api/health sinaliza degraded quando o MySQL cai', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: async () => {
          throw new Error('connection refused');
        },
      })
      .overrideProvider(RedisService)
      .useValue({ ping: async () => 'PONG' })
      .compile();

    const degradedApp = moduleFixture.createNestApplication();
    degradedApp.setGlobalPrefix('api');
    await degradedApp.init();

    const response = await request(degradedApp.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body.status).toBe('degraded');
    expect(response.body.checks.mysql.status).toBe('down');

    await degradedApp.close();
  });
});
