/**
 * E2E de auditoria.
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

describe.skipIf(!runDb)('Audit + rastreabilidade (e2e)', () => {
  let app: INestApplication;
  let _tenantA: { id: string; slug: string };
  let _userA: { id: string; email: string };
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
    const res = await agentA.post('/api/auth/register').send(tenantInput('audit')).expect(201);
    _tenantA = res.body.tenant;
    _userA = res.body.user;
  });

  it('auditoria registra LOGIN após login', async () => {
    await agentA.post('/api/auth/login').send({
      email: _userA.email,
      password: 'Senha123!',
    }).expect(200);
    const audit = await agentA.get('/api/audit?action=LOGIN').expect(200);
    expect(audit.body.meta.total).toBeGreaterThanOrEqual(1);
    for (const entry of audit.body.data as { tenantId: string }[]) {
      expect(entry.tenantId).toBe(_tenantA.id);
    }
  });

  it('auditoria registra CUSTOMER_CREATED', async () => {
    await agentA.post('/api/customers').send({
      name: 'Cliente Audit',
      cep: '01000000',
      city: 'São Paulo',
      state: 'SP',
    }).expect(201);
    const audit = await agentA.get('/api/audit?action=CUSTOMER_CREATED').expect(200);
    expect(audit.body.meta.total).toBeGreaterThanOrEqual(1);
    for (const entry of audit.body.data as { tenantId: string }[]) {
      expect(entry.tenantId).toBe(_tenantA.id);
    }
  });

  it('auditoria registra CARRIER_CREATED', async () => {
    await agentA.post('/api/carriers').send({
      name: 'Carrier Audit',
      baseFee: 50,
      pricePerKg: 1.8,
      pricePerKm: 0.6,
      riskPercent: 0.004,
    }).expect(201);
    const audit = await agentA.get('/api/audit?action=CARRIER_CREATED').expect(200);
    expect(audit.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('auditoria registra SIMULATION_CREATED', async () => {
    await agentA.post('/api/simulations').send({
      origin: 'São Paulo',
      destination: 'Fortaleza',
      weightKg: 100,
      lengthCm: 100,
      widthCm: 100,
      heightCm: 100,
      cargoValue: 5000,
    }).expect(201);
    const audit = await agentA.get('/api/audit?action=SIMULATION_CREATED').expect(200);
    expect(audit.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('auditoria registra USER_CREATED quando admin cria usuário', async () => {
    await agentA.post('/api/users').send({
      name: 'Usuario Audit',
      email: `audit-${stamp}@e2e.logisense.local`,
      password: 'Senha123!',
      role: 'OPERATOR',
    }).expect(201);
    const audit = await agentA.get('/api/audit?action=USER_CREATED').expect(200);
    expect(audit.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('filtra por entity', async () => {
    const res = await agentA.get('/api/audit?entity=Customer&limit=5').expect(200);
    expect(res.body.data).toBeInstanceOf(Array);
    for (const entry of res.body.data as { entity: string }[]) {
      expect(entry.entity).toBe('Customer');
    }
  });

  it('filtra por data range', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await agentA.get(`/api/audit?from=${today}&to=${today}`).expect(200);
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it('audit retorna paginação', async () => {
    const res = await agentA.get('/api/audit?page=1&limit=5').expect(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
  });

  it('tenant B não vê auditoria do tenant A', async () => {
    const agentB = request.agent(app.getHttpServer());
    await agentB.post('/api/auth/register').send(tenantInput('audit-b')).expect(201);
    const res = await agentB.get('/api/audit').expect(200);
    expect(res.body.data).toHaveLength(0);
  });
});
