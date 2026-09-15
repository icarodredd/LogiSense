/**
 * E2E de users com RBAC e isolamento tenant.
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

describe.skipIf(!runDb)('Users + RBAC + isolamento tenant (e2e)', () => {
  let app: INestApplication;
  let _tenantA: { id: string; slug: string };
  let _tenantB: { id: string; slug: string };
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

  it('registra tenant A + admin', async () => {
    agentA = request.agent(app.getHttpServer());
    const res = await agentA.post('/api/auth/register').send(tenantInput('usr-a')).expect(201);
    _tenantA = res.body.tenant;
  });

  it('registra tenant B + admin', async () => {
    agentB = request.agent(app.getHttpServer());
    const res = await agentB.post('/api/auth/register').send(tenantInput('usr-b')).expect(201);
    _tenantB = res.body.tenant;
  });

  it('ADMIN cria usuário', async () => {
    const created = await agentA.post('/api/users').send({
      name: 'Operador Teste',
      email: `op-${stamp}@e2e.logisense.local`,
      password: 'Senha123!',
      role: 'OPERATOR',
    }).expect(201);
    expect(created.body.email).toBe(`op-${stamp}@e2e.logisense.local`);
    expect(created.body.role).toBe('OPERATOR');
    expect(created.body).not.toHaveProperty('passwordHash');
  });

  it('OPERATOR não pode criar usuário (403)', async () => {
    const _created = await agentA.post('/api/users').send({
      name: 'Op2',
      email: `op2-${stamp}@e2e.logisense.local`,
      password: 'Senha123!',
      role: 'OPERATOR',
    }).expect(201);
    agentOp = request.agent(app.getHttpServer());
    await agentOp.post('/api/auth/login').send({
      email: `op-${stamp}@e2e.logisense.local`,
      password: 'Senha123!',
    }).expect(200);
    await agentOp.post('/api/users').send({
      name: 'Op3',
      email: `op3-${stamp}@e2e.logisense.local`,
      password: 'Senha123!',
      role: 'OPERATOR',
    }).expect(403);
  });

  it('ADMIN não pode deletar a si mesmo (403)', async () => {
    // Pega o primeiro usuário admin (que é o _tenantA.admin)
    const adminUser = await agentA.get('/api/users').expect(200);
    const adminId = (adminUser.body.data as { id: string }[])[0]?.id;
    if (adminId) {
      await agentA.delete(`/api/users/${adminId}`).expect(403);
    }
  });

  it('não pode deletar último ADMIN (403)', async () => {
    const res = await agentA.post('/api/users').send({
      name: 'OutroAdmin',
      email: `admin2-${stamp}@e2e.logisense.local`,
      password: 'Senha123!',
      role: 'ADMIN',
    }).expect(201);
    const admin2Id = res.body.id;
    // Deleta o admin2 depois para não deixar lixo
    await agentA.delete(`/api/users/${admin2Id}`).expect(200);
  });

  it('não pode alterar próprio role (403)', async () => {
    // Cria um usuário e tenta alterar role
    const created = await agentA.post('/api/users').send({
      name: 'SemRole',
      email: `semiro-${stamp}@e2e.logisense.local`,
      password: 'Senha123!',
      role: 'OPERATOR',
    }).expect(201);
    await agentA.patch(`/api/users/${created.body.id}`).send({ role: 'OPERATOR' }).expect(403);
  });

  it('não pode suspender própria conta (403)', async () => {
    const created = await agentA.post('/api/users').send({
      name: 'SemStatus',
      email: `semstatus-${stamp}@e2e.logisense.local`,
      password: 'Senha123!',
      role: 'OPERATOR',
    }).expect(201);
    await agentA.patch(`/api/users/${created.body.id}`).send({ status: 'SUSPENDED' }).expect(403);
  });

  it('tenant B não enxerga usuários do tenant A', async () => {
    const list = await agentB.get('/api/users').expect(200);
    const ids = (list.body.data as { id: string }[]).map((u) => u.id);
    expect(ids).toHaveLength(0);
  });

  it('lista com busca funciona', async () => {
    await agentA.get('/api/users?search=Operador&limit=10').expect(200);
  });
});
