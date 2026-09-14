# Multi-tenancy — LogiSense

Ver ADR `002-multi-tenancy`.

## Estratégia

Shared database + shared schema + `tenant_id` em toda entidade de negócio.

## Regra crítica

**O tenant atual vem exclusivamente da identidade autenticada (JWT).**
Nenhum endpoint aceita `tenantId` via query, body, param ou header para
definir o escopo — o `JwtAuthGuard` fixa `req.user.tenantId` a partir do
token e ainda reconfere `user.tenantId === payload.tenantId` no banco.

```text
cookie ls_access / Bearer
  -> JwtAuthGuard verifica assinatura + expiração
  -> busca usuário (id do `sub`) e confere tenant + status ACTIVE
  -> req.user = { id, tenantId, email, role }
  -> services filtram tudo por tenantId
```

## Padrão nos services

```ts
// leitura
this.prisma.customer.findFirst({ where: { id, tenantId: user.tenantId } });
// listagem
this.prisma.customer.findMany({ where: { tenantId: user.tenantId, ... } });
// escrita
this.prisma.customer.create({ data: { tenantId: user.tenantId, ... } });
```

Recurso de outro tenant resulta em **404** (não 403) para não confirmar existência.

## Unicidade por tenant

- `User`: `@@unique([tenantId, email])` — o mesmo e-mail pode existir em tenants
  diferentes; o login testa a senha em cada candidato e autentica no tenant correto.
- `Tenant.slug`: único global (usado em URLs futuras).

## Testes de isolamento

- Unitários: `users.service.spec.ts` (filtros sempre com `tenantId`, 404 cross-tenant).
- E2E com banco (`test/auth.e2e-spec.ts`, `RUN_DB_TESTS=true`): Tenant B busca
  usuário do Tenant A por ID → 404; listagem do B não contém dados do A.

## Seed

Dois tenants (`acme`, `beta`) para demonstrar isolamento no ambiente demo.
