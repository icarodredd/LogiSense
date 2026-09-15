/**
 * E2E de dashboard com dados reais do banco.
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

describe.skipIf(!runDb)('Dashboard (e2e)', () => {
  let app: INestApplication;
  let _tenantA: { id: string; slug: string };
  let agentA: request.Agent;
  let agentOp: request.Agent;

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
    const res = await agentA.post('/api/auth/register').send(tenantInput('dash')).expect(201);
    _tenantA = res.body.tenant;
  });

  it('cria carrier e simulações para ter dados no dashboard', async () => {
    await agentA.post('/api/carriers').send({
      name: 'TransDash',
      baseFee: 50,
      pricePerKg: 1.8,
      pricePerKm: 0.6,
      riskPercent: 0.004,
    }).expect(201);

    for (let i = 0; i < 5; i++) {
      await agentA.post('/api/simulations').send({
        origin: 'São Paulo',
        destination: 'Fortaleza',
        weightKg: 100 + i * 10,
        lengthCm: 100,
        widthCm: 100,
        heightCm: 100,
        cargoValue: 5000 + i * 1000,
      }).expect(201);
    }
  });

  it('GET /api/dashboard/overview retorna métricas', async () => {
    const res = await agentA.get('/api/dashboard/overview').expect(200);
    expect(res.body).toHaveProperty('totalSimulations');
    expect(res.body).toHaveProperty('avgFreight');
    expect(res.body).toHaveProperty('minFreight');
    expect(res.body).toHaveProperty('maxFreight');
    expect(res.body).toHaveProperty('potentialSavings');
    expect(res.body).toHaveProperty('carriersUsed');
    expect(res.body).toHaveProperty('topRoutes');
    expect(res.body).toHaveProperty('trendWeekly');
    expect(res.body.totalSimulations).toBeGreaterThanOrEqual(5);
  });

  it('GET /api/dashboard/carriers retorna dados das transportadoras', async () => {
    const res = await agentA.get('/api/dashboard/carriers').expect(200);
    expect(res.body).toBeInstanceOf(Array);
    for (const c of res.body) {
      expect(c).toHaveProperty('carrierName');
      expect(c).toHaveProperty('avgCost');
      expect(c).toHaveProperty('totalCost');
      expect(c).toHaveProperty('simulationCount');
    }
  });

  it('GET /api/dashboard/routes retorna dados das rotas', async () => {
    const res = await agentA.get('/api/dashboard/routes').expect(200);
    expect(res.body).toBeInstanceOf(Array);
    for (const r of res.body) {
      expect(r).toHaveProperty('origin');
      expect(r).toHaveProperty('destination');
      expect(r).toHaveProperty('count');
      expect(r).toHaveProperty('avgCost');
    }
  });

  it('OPERATOR pode acessar dashboard', async () => {
    const _created = await agentA.post('/api/users').send({
      name: 'Op Dash',
      email: `op-dash-${stamp}@e2e.logisense.local`,
      password: 'Senha123!',
      role: 'OPERATOR',
    }).expect(201);
    agentOp = request.agent(app.getHttpServer());
    await agentOp.post('/api/auth/login').send({
      email: `op-dash-${stamp}@e2e.logisense.local`,
      password: 'Senha123!',
    }).expect(200);
    await agentOp.get('/api/dashboard/overview').expect(200);
    await agentOp.get('/api/dashboard/carriers').expect(200);
    await agentOp.get('/api/dashboard/routes').expect(200);
  });

  it('tenant B vê dashboard vazio', async () => {
    const agentB = request.agent(app.getHttpServer());
    await agentB.post('/api/auth/register').send(tenantInput('dash-b')).expect(201);
    const res = await agentB.get('/api/dashboard/overview').expect(200);
    expect(res.body.totalSimulations).toBe(0);
  });
});
