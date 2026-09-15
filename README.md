# LogiSense

Plataforma SaaS multi-tenant de inteligência logística e análise de fretes.

## O que está implementado

- Landing page pública e área restrita em Next.js.
- Login por email/senha, JWT em cookies HttpOnly, refresh token rotativo, RBAC, MFA/TOTP e OAuth Google/GitHub.
- Isolamento por tenant no banco compartilhado.
- Gestão de usuários, clientes e transportadoras.
- Simulação comparativa de fretes e histórico.
- Dashboard e insights determinísticos baseados nos dados persistidos.
- Integrações ViaCEP e Open-Meteo.
- Upload CSV/XLSX processado por BullMQ/Redis.
- Progresso de importação em tempo real via Socket.IO.
- Auditoria, health check, logs estruturados e request ID.

## Stack

| Camada | Tecnologias |
| --- | --- |
| API | Node.js, NestJS, TypeScript, Prisma |
| Web | Next.js 16, React, TypeScript, Tailwind |
| Dados | MySQL 8, Redis 7 |
| Processamento | BullMQ, Socket.IO |
| Qualidade | Vitest, Supertest, ESLint, oxlint |

## Execução local

Pré-requisitos: Node.js 22+, pnpm 10+, Docker e Docker Compose.

```bash
cp .env.example .env
docker compose up -d --build
curl http://localhost:3001/api/health
```

Aplicações:

- Web: http://localhost:3000
- API: http://localhost:3001/api
- Health: http://localhost:3001/api/health

Para executar fora do Compose, consulte `backend/README.md` e `frontend/README.md`.

## Contas demo

O seed cria dados para dois tenants e utiliza a senha `Senha123!`:

| Email | Perfil | Tenant |
| --- | --- | --- |
| `admin@acme.logisense.local` | ADMIN | Acme |
| `manager1@acme.logisense.local` | MANAGER | Acme |
| `op1@acme.logisense.local` | OPERATOR | Acme |
| `admin@beta.logisense.local` | ADMIN | Beta |

Execute o seed quando necessário:

```bash
cd backend
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
```

## Validação

```bash
cd backend
pnpm test
pnpm lint
pnpm build

cd ../frontend
pnpm lint
pnpm build
```

Os E2E com banco real exigem MySQL disponível:

```bash
cd backend
RUN_DB_TESTS=true DATABASE_URL='mysql://logisense:logisense@localhost:3306/logisense' pnpm test:e2e
```

## Variáveis e produção

Nunca versione secrets. Copie `.env.example` e configure, no ambiente de produção:

- `JWT_ACCESS_SECRET` e `MFA_ENCRYPTION_KEY` fortes e exclusivos.
- `DATABASE_URL` e `REDIS_URL` gerenciados pelo provedor.
- `COOKIE_SECURE=true`.
- `CORS_ORIGINS` e `FRONTEND_URL` com os domínios públicos.
- URLs e credenciais OAuth Google/GitHub apontando para `/api/auth/{provider}/callback`.

O deploy público ainda depende da escolha e configuração do provedor de hospedagem. A aplicação falha no boot em produção quando secrets obrigatórios não estão configurados.

## Arquitetura e decisões

- `docs/architecture.md`
- `docs/database.md`
- `docs/multi-tenancy.md`
- `docs/authentication.md`
- `docs/async-processing.md`
- `docs/external-integrations.md`
- `docs/testing.md`
- `docs/decisions/`

As regras de projeto e os artefatos utilizados no desenvolvimento assistido por IA estão em `AGENTS.md` e `frontend/AGENTS.md`.

## Fluxo de demonstração

1. Entre com uma conta demo.
2. Cadastre ou importe clientes e transportadoras.
3. Crie uma simulação e compare as cotações.
4. Consulte o histórico, dashboard e insights.
5. Envie um CSV de clientes em **Importações** e acompanhe o processamento em tempo real.
6. Use uma conta do tenant Beta para confirmar que os dados do tenant Acme não aparecem.
