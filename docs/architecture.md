# Arquitetura — LogiSense API

Monólito modular NestJS (TypeScript). Ver ADR `001-monolith-modular`.

## Estrutura

```text
src/
├── main.ts                 # bootstrap: helmet, cookies, CORS, prefixo /api, ValidationPipe
├── app.module.ts           # guards/filtros/interceptores globais + módulos
├── config/configuration.ts # config tipada via @nestjs/config (falha no boot sem secrets)
├── common/
│   ├── decorators/         # @Public, @Roles, @CurrentUser
│   ├── filters/            # envelope de erro padronizado (§ Tratamento de erros)
│   ├── guards/             # (guards de auth vivem no módulo auth)
│   ├── http/               # RequestWithId, paginação
│   ├── interceptors/       # logging estruturado de requisições
│   ├── logger/             # AppLogger (pino; pretty em dev, JSON em prod)
│   └── middleware/         # RequestIdMiddleware (gera/propaga x-request-id)
├── database/               # DatabaseModule global: PrismaService + RedisService
├── modules/
│   ├── health/             # GET /api/health (checks MySQL + Redis)
│   ├── auth/               # register/login/refresh/logout + guards + tokens
│   ├── users/              # CRUD de usuários do tenant
│   ├── tenants/            # GET /api/tenants/me
│   └── audit/              # AuditService + GET /api/audit
└── queue/                  # (Fase async: BullMQ)
```

## Convenções

- **Prefixo global**: `/api`. Rotas: `/api/auth/*`, `/api/users`, `/api/health`, etc.
- **Camadas**: controller (HTTP/DTO) → service (regra) → Prisma (persistência).
  Controller não contém regra de negócio; service não conhece HTTP
  (recebe `AuditContext` explícito em vez de `@Req()`).
- **DTOs** com `class-validator`; `ValidationPipe` global com
  `whitelist + forbidNonWhitelisted + transform`.
- **Respostas de erro** (filtro global): `{ statusCode, code, message, timestamp, requestId }`.
  Nunca vaza stack, secret ou token. `code` é estável para o frontend
  (ex.: `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `FORBIDDEN`).
- **Logs estruturados** com `requestId`, método, rota, status e duração.
- **Paginação**: `?page=&limit=` (máx. 100) → `{ data, meta: { page, limit, total, totalPages } }`.
- **Imports ESM**: usar extensão `.js` nos imports relativos (tsconfig `nodenext`).

## Guards globais (ordem)

1. `ThrottlerGuard` — 120 req/min global; login limitado a 10/min.
2. `JwtAuthGuard` — valida access (cookie `ls_access` ou `Bearer`), pula `@Public`,
   revalida usuário/status e fixa `req.user` com o **tenant do token**.
3. `RolesGuard` — exige `@Roles(...)` quando presente.

## Health

`GET /api/health` → `{ status: ok|degraded, checks: { mysql, redis } }` com latência.
Sempre 200 (o campo `status` indica degradação) para não derrubar probes simples.
