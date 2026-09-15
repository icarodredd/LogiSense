# Testes — LogiSense

## Estrutura

Usamos **Vitest** para testes unitários e integração. Os testes estão localizados junto aos arquivos fonte com sufixo `.spec.ts`.

## Comandos

```bash
pnpm test              # Executa todos os testes
pnpm test:watch        # Modo watch
pnpm test:coverage     # Com cobertura (se configurado)
```

## Cobertura atual

| Módulo | Testes | Status |
|---|---|---|
| Auth | Login, register, refresh, JWT, MFA, OAuth, RBAC | ✅ |
| Customers | CRUD, CEP, tenant isolation | ✅ |
| Imports | Service, Worker, upload, retry | ✅ |
| Integrations | ViaCEP, Open-Meteo | ✅ |
| Insights | Economy, carrier, concentration, trend | ✅ |
| WebSocket | Cookie auth, room authorization, progress events | ✅ |
| Audit | Sanitization de metadata | ✅ |
| **Total** | **122 testes, 20 arquivos unitários** | ✅ |

## Padrões de teste

### Unitários

- Mock do Prisma via funções `vi.fn()`
- `AuthenticatedUser` simulado com `tenantId`, `role`
- `AuditContext` com `ip`, `requestId`

### Exemplo de teste de service

```ts
const service = new MyService(
  prisma as any,
  { log: vi.fn() } as any,
  processor as any,
);
```

### Testes de isolamento por tenant

Verificam que recursos do Tenant A não são acessíveis pelo Tenant B.

## Lacunas de validação

- E2E completo com banco real requer `RUN_DB_TESTS=true` e MySQL/Redis disponíveis.
- OAuth de produção depende de credenciais e callbacks configurados nos provedores.
- Smoke test público depende do ambiente de deploy.

## Qualidade

- Nenhum mock de implementação (usamos `as any` para dependências)
- Assertions específicas com `expect.objectContaining`
- Testes focam em regras de negócio, não em infraestrutura
