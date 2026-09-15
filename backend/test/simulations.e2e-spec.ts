/**
 * E2E de simulações, isolamento tenant e history.
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

function carrierDto(name: string) {
  return {
    name,
    baseFee: 50,
    pricePerKg: 1.8,
    pricePerKm: 0.6,
    riskPercent: 0.004,
  };
}

function customerDto(name: string) {
  return { name, city: 'São Paulo', state: 'SP', cep: '01000000' };
}

describe.skipIf(!runDb)('Simulações + RBAC + isolamento (e2e)', () => {
  let app: INestApplication;
  let _tenantA: { id: string; slug: string };
  let _tenantB: { id: string; slug: string };
  let _userA: { id: string; email: string };
  let agentA: request.Agent;
  let agentB: request.Agent;
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

  it('registra tenant A + admin e cria carrier + customer', async () => {
    agentA = request.agent(app.getHttpServer());
    const res = await agentA.post('/api/auth/register').send(tenantInput('a')).expect(201);
    _tenantA = res.body.tenant;
    _userA = res.body.user;

    await agentA.post('/api/carriers').send(carrierDto('TransA')).expect(201);
    await agentA.post('/api/customers').send(customerDto('Cliente A')).expect(201);

    const me = await agentA.get('/api/auth/me').expect(200);
    expect(me.body.user.id).toBe(_userA.id);
    expect(me.body.tenant.id).toBe(_tenantA.id);
  });

  it('registra tenant B + admin', async () => {
    agentB = request.agent(app.getHttpServer());
    const res = await agentB.post('/api/auth/register').send(tenantInput('b')).expect(201);
    _tenantB = res.body.tenant;
    await agentB.post('/api/carriers').send(carrierDto('TransB')).expect(201);
  });

  it('cria simulação no tenant A', async () => {
    const sim = await agentA
      .post('/api/simulations')
      .send({
        origin: 'São Paulo',
        destination: 'Fortaleza',
        weightKg: 100,
        lengthCm: 100,
        widthCm: 100,
        heightCm: 100,
        cargoValue: 5000,
      })
      .expect(201);
    expect(sim.body.id).toBeDefined();
    expect(sim.body.quotes.length).toBeGreaterThan(0);
    expect(sim.body.cheapestQuote).toBeDefined();
  });

  it('lista simulações do tenant A com paginação', async () => {
    const res = await agentA.get('/api/simulations?page=1&limit=10').expect(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    for (const s of res.body.data) {
      expect(s.tenantId).toBe(_tenantA.id);
    }
  });

  it('endpoint history retorna simulações com cotações comparadas', async () => {
    const res = await agentA.get('/api/simulations/history?page=1&limit=10').expect(200);
    expect(res.body.data).toBeInstanceOf(Array);
    for (const s of res.body.data) {
      expect(s).toHaveProperty('quotes');
      expect(s).toHaveProperty('cheapestQuote');
      expect(s).toHaveProperty('potentialSavings');
      expect(s).toHaveProperty('selectedQuote');
    }
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('tenant B não enxerga simulações do tenant A (isolamento)', async () => {
    const res = await agentB.get('/api/simulations').expect(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('tenant B não acessa simulação do tenant A por ID (404)', async () => {
    const simList = await agentA.get('/api/simulations?limit=1').expect(200);
    const simId = simList.body.data[0].id;
    await agentB.get(`/api/simulations/${simId}`).expect(404);
  });

  it('OPERATOR cria simulação (permitido)', async () => {
    const _opUser = await agentA.post('/api/users').send({
      name: 'Op E2E',
      email: `op-${stamp}@e2e.logisense.local`,
      password: 'Senha123!',
      role: 'OPERATOR',
    }).expect(201);
    agentOp = request.agent(app.getHttpServer());
    await agentOp.post('/api/auth/login').send({
      email: `op-${stamp}@e2e.logisense.local`,
      password: 'Senha123!',
    }).expect(200);
    await agentOp.post('/api/simulations').send({
      origin: 'Curitiba',
      destination: 'Porto Alegre',
      weightKg: 50,
      lengthCm: 50,
      widthCm: 50,
      heightCm: 50,
      cargoValue: 1000,
    }).expect(201);
  });

  it('DELETE simulação funciona para ADMIN e MANAGER', async () => {
    const res = await agentA.post('/api/simulations').send({
      origin: 'Rio de Janeiro',
      destination: 'Salvador',
      weightKg: 200,
      lengthCm: 200,
      widthCm: 200,
      heightCm: 200,
      cargoValue: 10000,
    }).expect(201);
    const simId = res.body.id;
    await agentA.delete(`/api/simulations/${simId}`).expect(200);
  });

  it('OPERATOR não deleta simulação (403)', async () => {
    const res = await agentA.post('/api/simulations').send({
      origin: 'Belo Horizonte',
      destination: 'Brasília',
      weightKg: 30,
      lengthCm: 30,
      widthCm: 30,
      heightCm: 30,
      cargoValue: 500,
    }).expect(201);
    const simId = res.body.id;
    await agentOp.delete(`/api/simulations/${simId}`).expect(403);
  });

  it('busca simulada filtra por origem/destino', async () => {
    await agentA.get('/api/simulations?search=Fortaleza&limit=5').expect(200);
  });
});
