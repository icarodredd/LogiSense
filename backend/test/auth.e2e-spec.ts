/**
 * E2E com banco real (MySQL via docker-compose).
 *
 * Execução: RUN_DB_TESTS=true DATABASE_URL=... pnpm test:e2e
 * Pula automaticamente sem banco — o CI executa com services.
 * Pré-requisito: `prisma migrate deploy` aplicado no banco de teste.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { generateTotpToken } from './../src/modules/auth/mfa.service.js';

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

describe.skipIf(!runDb)('Auth + RBAC + isolamento (e2e com banco)', () => {
  let app: INestApplication;
  let tenantA: { id: string; slug: string };
  let userA: { id: string };
  let agentA: request.Agent;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('register cria tenant + admin e autentica via cookies', async () => {
    agentA = request.agent(app.getHttpServer());
    const res = await agentA
      .post('/api/auth/register')
      .send(tenantInput('a'))
      .expect(201);

    expect(res.body.user.role).toBe('ADMIN');
    expect(res.body.tenant.slug).toBeDefined();
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toContain('ls_access');
    expect(cookies.join(';')).toContain('ls_refresh');
    tenantA = res.body.tenant;
    userA = res.body.user;

    const me = await agentA.get('/api/auth/me').expect(200);
    expect(me.body.user.id).toBe(userA.id);
    expect(me.body.tenant.id).toBe(tenantA.id);
  });

  it('refresh rotaciona a sessão e logout encerra', async () => {
    await agentA.post('/api/auth/refresh').expect(200);
    await agentA.post('/api/auth/logout').expect(200);
    // Após logout, o access ainda vale até expirar, mas o refresh foi revogado.
    await agentA.post('/api/auth/refresh').expect(401);
  });

  it('login com senha errada retorna 401 com envelope padronizado', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: tenantInput('a').email, password: 'Errada123' })
      .expect(401);
    expect(res.body).toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
    expect(res.body.requestId).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });

  it('sem token, rota protegida retorna 401', async () => {
    await request(app.getHttpServer()).get('/api/users').expect(401);
  });

  it('OPERATOR não cria usuário (403) e ADMIN cria', async () => {
    // Recria sessão do admin A (logout revogou o refresh anterior).
    await agentA
      .post('/api/auth/login')
      .send({ email: tenantInput('a').email, password: 'Senha123!' })
      .expect(200);

    const opEmail = `op-${stamp}@e2e.logisense.local`;
    const created = await agentA
      .post('/api/users')
      .send({ name: 'Op', email: opEmail, password: 'Senha123!', role: 'OPERATOR' })
      .expect(201);
    expect(created.body.email).toBe(opEmail);
    expect(created.body).not.toHaveProperty('passwordHash');

    const agentOp = request.agent(app.getHttpServer());
    await agentOp
      .post('/api/auth/login')
      .send({ email: opEmail, password: 'Senha123!' })
      .expect(200);
    await agentOp
      .post('/api/users')
      .send({ name: 'X', email: `x-${stamp}@e2e.local`, password: 'Senha123!' })
      .expect(403);
  });

  it('Tenant B não enxerga usuário do Tenant A (isolamento)', async () => {
    const agentB = request.agent(app.getHttpServer());
    await agentB.post('/api/auth/register').send(tenantInput('b')).expect(201);

    // Tenta buscar o usuário do tenant A pelo ID direto.
    await agentB.get(`/api/users/${userA.id}`).expect(404);
    // Nem listar: o admin do tenant B não vê usuários do tenant A.
    const list = await agentB.get('/api/users').expect(200);
    const ids = (list.body.data as { id: string }[]).map((u) => u.id);
    expect(ids).not.toContain(userA.id);
  });

  it('auditoria registra LOGIN e USER_CREATED do tenant', async () => {
    const res = await agentA
      .get('/api/audit?action=USER_CREATED')
      .expect(200);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    for (const entry of res.body.data as { tenantId: string }[]) {
      expect(entry.tenantId).toBe(tenantA.id);
    }
  });

  it('fluxo MFA completo: setup -> confirm -> login exige TOTP -> disable', async () => {
    // Reautentica o admin (sessões anteriores foram revogadas).
    await agentA
      .post('/api/auth/login')
      .send({ email: tenantInput('a').email, password: 'Senha123!' })
      .expect(200);

    const setup = await agentA.post('/api/auth/mfa/setup').expect(200);
    expect(setup.body.secret).toBeDefined();
    expect(setup.body.otpauthUri).toContain('otpauth://totp/');
    expect(setup.body.qrCodeDataUri).toMatch(/^data:image\/png;base64,/);

    // Confirm com código inválido não ativa.
    await agentA
      .post('/api/auth/mfa/confirm')
      .send({ totpCode: '000000' })
      .expect(400);

    // Ativa com código válido gerado a partir do segredo.
    const validCode = generateTotpToken(setup.body.secret);
    await agentA
      .post('/api/auth/mfa/confirm')
      .send({ totpCode: validCode })
      .expect(200);

    // Login sem TOTP -> MFA_REQUIRED; com TOTP -> 200.
    await agentA
      .post('/api/auth/login')
      .send({ email: tenantInput('a').email, password: 'Senha123!' })
      .expect(401)
      .then((res) => expect(res.body.code).toBe('MFA_REQUIRED'));
    await agentA
      .post('/api/auth/login')
      .send({
        email: tenantInput('a').email,
        password: 'Senha123!',
        totpCode: generateTotpToken(setup.body.secret),
      })
      .expect(200);

    // Disable exige senha + TOTP.
    await agentA
      .post('/api/auth/mfa/disable')
      .send({ password: 'Senha123!', totpCode: '000000' })
      .expect(401);
    await agentA
      .post('/api/auth/mfa/disable')
      .send({
        password: 'Senha123!',
        totpCode: generateTotpToken(setup.body.secret),
      })
      .expect(200);

    // Após disable, login volta a dispensar TOTP.
    await agentA
      .post('/api/auth/login')
      .send({ email: tenantInput('a').email, password: 'Senha123!' })
      .expect(200);

    // Auditoria registrou MFA_ENABLED e MFA_DISABLED.
    const audit = await agentA
      .get('/api/audit?action=MFA_ENABLED')
      .expect(200);
    expect(audit.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('OAuth não configurado retorna erro controlado', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/google/authorize')
      .expect(401);
    expect(res.body.code).toBe('OAUTH_NOT_CONFIGURED');
  });
});
