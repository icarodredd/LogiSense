/**
 * E2E de imports com upload e processamento async.
 * Execução: RUN_DB_TESTS=true DATABASE_URL=... pnpm test:e2e
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { join } from 'node:path';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

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

describe.skipIf(!runDb)('Imports + processamento assíncrono (e2e)', () => {
  let app: INestApplication;
  let _tenantA: { id: string; slug: string };
  let agentA: request.Agent;
  let tempDir: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    tempDir = await mkdir(join(tmpdir(), `imports-e2e-${stamp}`), { recursive: true });
  });

  afterAll(async () => {
    await app.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('registra tenant + admin', async () => {
    agentA = request.agent(app.getHttpServer());
    const res = await agentA.post('/api/auth/register').send(tenantInput('imp-a')).expect(201);
    _tenantA = res.body.tenant;
  });

  it('list imports está vazio', async () => {
    const res = await agentA.get('/api/imports?limit=10').expect(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('upload CSV de clientes funciona', async () => {
    const csv = 'name,document,cep,email,city,state\nNovoCliente,12345678901,01000000,contato@teste.com.br,São Paulo,SP';
    const filePath = join(tempDir, 'clientes.csv');
    await writeFile(filePath, csv, 'utf-8');

    const res = await agentA
      .post('/api/imports')
      .attach('file', filePath)
      .field('type', 'CUSTOMERS')
      .expect(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.type).toBe('CUSTOMERS');
    expect(res.body.filename).toBe('clientes.csv');
  });

  it('upload xlsx de transportadoras funciona', async () => {
    const csv = 'name,baseFee,pricePerKg,pricePerKm,riskPercent\nTransNova,40,1.9,0.65,0.004';
    const filePath = join(tempDir, 'carriers.xlsx');
    await writeFile(filePath, csv, 'utf-8');

    const res = await agentA
      .post('/api/imports')
      .attach('file', filePath)
      .field('type', 'CARRIERS')
      .expect(201);
    expect(res.body.type).toBe('CARRIERS');
    expect(res.body.status).toBe('PENDING');
  });

  it('rejeita upload sem arquivo', async () => {
    await agentA.post('/api/imports').send({ type: 'CUSTOMERS' }).expect(400);
  });

  it('rejeita arquivo com extensão inválida', async () => {
    const txtPath = join(tempDir, 'data.txt');
    await writeFile(txtPath, 'foo', 'utf-8');
    await agentA.post('/api/imports').attach('file', txtPath).field('type', 'CUSTOMERS').expect(400);
  });

  it('retry de import falhado retorna 400 para não-FAILED', async () => {
    const res = await agentA.post('/api/imports/unknown/retry').expect(404);
    expect(res.body.code).toBe('IMPORT_NOT_FOUND');
  });

  it('tenant B não enxerga imports do tenant A', async () => {
    const agentB = request.agent(app.getHttpServer());
    await agentB.post('/api/auth/register').send(tenantInput('imp-b')).expect(201);
    const res = await agentB.get('/api/imports').expect(200);
    expect(res.body.data).toHaveLength(0);
  });
});
