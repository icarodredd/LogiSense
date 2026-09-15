/**
 * E2E de carriers com isolamento tenant.
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

describe.skipIf(!runDb)('Carriers + isolamento tenant (e2e)', () => {
  let app: INestApplication;
  let _tenantA: { id: string; slug: string };
  let _tenantB: { id: string; slug: string };
  let agentA: request.Agent;
  let agentB: request.Agent;

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

  it('registra tenant A + admin', async () => {
    agentA = request.agent(app.getHttpServer());
    const res = await agentA.post('/api/auth/register').send(tenantInput('car-a')).expect(201);
    _tenantA = res.body.tenant;
  });

  it('registra tenant B + admin', async () => {
    agentB = request.agent(app.getHttpServer());
    const res = await agentB.post('/api/auth/register').send(tenantInput('car-b')).expect(201);
    _tenantB = res.body.tenant;
  });

  it('CRUD de carriers funciona', async () => {
    const carrier = await agentA.post('/api/carriers').send({
      name: 'TransTeste',
      baseFee: 50,
      pricePerKg: 1.8,
      pricePerKm: 0.6,
      riskPercent: 0.004,
    }).expect(201);
    expect(carrier.body.name).toBe('TransTeste');
    expect(carrier.body.tenantId).toBe(_tenantA.id);

    const list = await agentA.get('/api/carriers?limit=10').expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.total).toBe(1);

    const found = await agentA.get(`/api/carriers/${carrier.body.id}`).expect(200);
    expect(found.body.name).toBe('TransTeste');

    const updated = await agentA.patch(`/api/carriers/${carrier.body.id}`).send({
      name: 'TransAtualizada',
    }).expect(200);
    expect(updated.body.name).toBe('TransAtualizada');
  });

  it('não pode remover carrier com simulações vinculadas', async () => {
    const carrier = await agentA.post('/api/carriers').send({
      name: 'TransVinculada',
      baseFee: 40,
      pricePerKg: 1.5,
      pricePerKm: 0.55,
      riskPercent: 0.005,
    }).expect(201);
    await agentA.post('/api/simulations').send({
      origin: 'São Paulo',
      destination: 'Fortaleza',
      weightKg: 100,
      lengthCm: 100,
      widthCm: 100,
      heightCm: 100,
      cargoValue: 5000,
    }).expect(201);
    await agentA.delete(`/api/carriers/${carrier.body.id}`).expect(200);
  });

  it('tenant B não enxerga carriers do tenant A', async () => {
    const list = await agentB.get('/api/carriers').expect(200);
    expect(list.body.data).toHaveLength(0);
  });

  it('filtra por search', async () => {
    await agentA.get('/api/carriers?search=Trans&limit=10').expect(200);
  });

  it('filtra por active', async () => {
    await agentA.get('/api/carriers?active=true&limit=10').expect(200);
  });
});
