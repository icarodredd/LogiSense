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
| Auth | Login, register, refresh, JWT | ✅ |
| Customers | CRUD, CEP, tenant isolation | ✅ |
| Imports | Service, Worker, upload | ✅ |
| Integrations | ViaCEP, Open-Meteo | ✅ |
| Insights | Economy, carrier, concentration, trend | ✅ |
| Audit | Sanitization de metadata | ✅ |
| **Total** | **100 testes, 16 arquivos** | ✅ |

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

## Testes que não existem ainda

- E2E com banco real (requer `RUN_DB_TESTS=true`)
- Testes de segurança (rate limiting, MFA)
- Testes de WebSocket
- Testes de import real (CSV/XLSX)

## Qualidade

- Nenhum mock de implementação (usamos `as any` para dependências)
- Assertions específicas com `expect.objectContaining`
- Testes focam em regras de negócio, não em infraestrutura
