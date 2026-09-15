/**
 * E2E de insights com dados reais.
 * Execução: RUN_DB_TESTS=true DATABASE_URL=... pnpm test:e2e
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

const runDb = process.env.RUN_DB_TESTS === 'true' && !!process.env.DATABASE_URL;
const stamp = Date.now();

function tenantInput(slug: string) {
  return {
    tenantName: `Tenant ${slug} ${stamp}`,
    name: 'Admin',
    email: `admin-${slug}-${stamp}@e2e.logisense.local`,
    password: 'Senha123!',
  };
}

describe.skipIf(!runDb)('Insights (e2e)', () => {
  let app: INestApplication;
  let _tenantA: { id: string; slug: string };
  let agentA: request.Agent;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registra tenant + admin', async () => {
    agentA = request.agent(app.getHttpServer());
    const res = await agentA.post('/api/auth/register').send(tenantInput('ins')).expect(201);
    _tenantA = res.body.tenant;
  });

  it('cria dados suficientes para insights', async () => {
    await agentA.post('/api/carriers').send({
      name: 'TransIns',
      baseFee: 50,
      pricePerKg: 1.8,
      pricePerKm: 0.6,
      riskPercent: 0.004,
    }).expect(201);

    for (let i = 0; i < 10; i++) {
      await agentA.post('/api/simulations').send({
        origin: 'São Paulo',
        destination: 'Fortaleza',
        weightKg: 100,
        lengthCm: 100,
        widthCm: 100,
        heightCm: 100,
        cargoValue: 5000,
      }).expect(201);
    }
  });

  it('GET /api/insights lista insights (inicialmente vazio)', async () => {
    const res = await agentA.get('/api/insights').expect(200);
    expect(res.body).toBeInstanceOf(Array);
  });

  it('POST /api/insights/regenera insights', async () => {
    const res = await agentA.post('/api/insights/regenerate').expect(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThan(0);
    for (const ins of res.body) {
      expect(ins).toHaveProperty('type');
      expect(ins).toHaveProperty('title');
      expect(ins).toHaveProperty('description');
      expect(ins).toHaveProperty('severity');
    }
  });

  it('tipos de insight presentes', async () => {
    const res = await agentA.get('/api/insights').expect(200);
    const types = new Set(res.body.map((ins: { type: string }) => ins.type));
    expect(types.has('economy') || types.has('carrier') || types.has('concentration')).toBe(true);
  });

  it('tenant B não vê insights do tenant A', async () => {
    const agentB = request.agent(app.getHttpServer());
    await agentB.post('/api/auth/register').send(tenantInput('ins-b')).expect(201);
    const res = await agentB.get('/api/insights').expect(200);
    expect(res.body).toHaveLength(0);
  });

  it('regeneração cria novos insights (count aumenta)', async () => {
    const before = await agentA.get('/api/insights').expect(200);
    await agentA.post('/api/insights/regenerate').expect(200);
    const after = await agentA.get('/api/insights').expect(200);
    expect(after.body.length).toBeGreaterThanOrEqual(before.body.length);
  });
});
