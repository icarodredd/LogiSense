# LogiSense API (backend)

Monólito modular NestJS + Prisma (MySQL) + Redis. Prefixo global `/api`.
Docs de produto/arquitetura em `../docs/`.

## Pré-requisitos

- Node 22+, pnpm 10+
- Docker + Docker Compose (MySQL 8 + Redis 7)

## Subindo local

```bash
# 1. Infra (na raiz do repo)
cp .env.example .env
docker compose up -d mysql redis

# 2. API
cd backend
cp .env.example .env
pnpm install
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
pnpm start:dev   # http://localhost:3001/api/health
```

Ou tudo via compose: `docker compose up -d --build` (api em modo dev na porta 3001).

## Contas demo (seed, senha `Senha123!`)

| E-mail | Perfil | Tenant |
|---|---|---|
| `admin@acme.logisense.local` | ADMIN | Acme (principal) |
| `manager1@acme.logisense.local` | MANAGER | Acme |
| `op1@acme.logisense.local` | OPERATOR | Acme |
| `admin@beta.logisense.local` | ADMIN | Beta (isolamento) |

## Scripts

| Comando | O quê |
|---|---|
| `pnpm build` | Compila (`nest build`) |
| `pnpm start:dev` | Dev com watch |
| `pnpm test` | Unitários (vitest) |
| `pnpm test:e2e` | E2E (health com mocks; DB quando `RUN_DB_TESTS=true`) |
| `pnpm lint` | oxlint |

E2E com banco real (CI/docker):

```bash
RUN_DB_TESTS=true DATABASE_URL=mysql://... pnpm test:e2e
```

## Endpoints (fundação)

- `GET /api/health` — status + checks MySQL/Redis
- `POST /api/auth/register` — cria tenant + admin (público)
- `POST /api/auth/login` — email/senha (público, 10 req/min)
- `POST /api/auth/refresh` — rotação via cookie (público)
- `POST /api/auth/logout` · `GET /api/auth/me`
- `GET /api/users` · `POST /api/users` · `GET/PATCH/DELETE /api/users/:id`
- `GET /api/tenants/me` · `GET /api/audit`
- `GET /api/integrations/cep/:cep` — consulta ViaCEP
- `GET /api/integrations/weather?lat=&lon=` — consulta Open-Meteo

Erros seguem o envelope `{ statusCode, code, message, timestamp, requestId }`.

## Integrações externas

| Provedor | Endpoint | Finalidade |
|---|---|---|
| ViaCEP | `GET /api/integrations/cep/:cep` | Endereço por CEP |
| Open-Meteo | `GET /api/integrations/weather` | Condições climáticas |

Docs detalhadas em `docs/external-integrations.md`.
