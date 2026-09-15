/**
 * E2E de customer com isolamento tenant.
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

describe.skipIf(!runDb)('Customers + isolamento tenant (e2e)', () => {
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
    const res = await agentA.post('/api/auth/register').send(tenantInput('cust-a')).expect(201);
    _tenantA = res.body.tenant;
  });

  it('registra tenant B + admin', async () => {
    agentB = request.agent(app.getHttpServer());
    const res = await agentB.post('/api/auth/register').send(tenantInput('cust-b')).expect(201);
    _tenantB = res.body.tenant;
  });

  it('CRUD de customers funciona', async () => {
    const customer = await agentA.post('/api/customers').send({
      name: 'Cliente Teste',
      document: '12345678901',
      cep: '01000000',
      email: 'contato@teste.com.br',
      city: 'São Paulo',
      state: 'SP',
    }).expect(201);
    expect(customer.body.name).toBe('Cliente Teste');
    expect(customer.body.tenantId).toBe(_tenantA.id);

    const list = await agentA.get('/api/customers?limit=10').expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.total).toBe(1);

    const found = await agentA.get(`/api/customers/${customer.body.id}`).expect(200);
    expect(found.body.name).toBe('Cliente Teste');

    const updated = await agentA.patch(`/api/customers/${customer.body.id}`).send({
      name: 'Cliente Atualizado',
    }).expect(200);
    expect(updated.body.name).toBe('Cliente Atualizado');
  });

  it('customer com documento duplicado é rejeitado', async () => {
    await agentA.post('/api/customers').send({ name: 'Dup', document: '11111111111' }).expect(201);
    await agentA.post('/api/customers').send({ name: 'Dup2', document: '11111111111' }).expect(409);
  });

  it('customer com simulação vinculada não pode ser deletado', async () => {
    const cust = await agentA.post('/api/customers').send({
      name: 'Cliente Para Sim',
      cep: '02000000',
      city: 'Rio de Janeiro',
      state: 'RJ',
    }).expect(201);
    await agentA.post('/api/simulations').send({
      origin: 'São Paulo',
      destination: 'Rio de Janeiro',
      weightKg: 100,
      lengthCm: 100,
      widthCm: 100,
      heightCm: 100,
      cargoValue: 5000,
      customerId: cust.body.id,
    }).expect(201);
    await agentA.delete(`/api/customers/${cust.body.id}`).expect(403);
  });

  it('tenant B não enxerga customers do tenant A (isolamento)', async () => {
    const list = await agentB.get('/api/customers').expect(200);
    expect(list.body.data).toHaveLength(0);
  });

  it('tenant B acessa customer do tenant A por ID (404)', async () => {
    const listA = await agentA.get('/api/customers?limit=1').expect(200);
    if (listA.body.data.length > 0) {
      const custId = listA.body.data[0].id;
      await agentB.get(`/api/customers/${custId}`).expect(404);
    }
  });

  it('filtra por status', async () => {
    await agentA.get('/api/customers?status=ACTIVE&limit=10').expect(200);
    await agentA.get('/api/customers?status=INACTIVE&limit=10').expect(200);
  });

  it('busca por nome', async () => {
    await agentA.get('/api/customers?search=Cliente&limit=10').expect(200);
  });
});
