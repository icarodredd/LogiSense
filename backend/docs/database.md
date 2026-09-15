# Banco de Dados — LogiSense

## Motor

MySQL 8 (via Prisma ORM). Schema compartilhado entre tenants (`tenant_id` em toda entidade).

## Modelos

### Tenant

| Campo | Tipo | Notas |
|---|---|---|
| id | VARCHAR(191) | PK, UUID |
| name | VARCHAR(191) | Nome da empresa |
| slug | VARCHAR(191) | UNIQUE, URL-friendly |
| createdAt | DATETIME(3) | |
| updatedAt | DATETIME(3) | |

### User

| Campo | Tipo | Notas |
|---|---|---|
| id | VARCHAR(191) | PK, UUID |
| tenantId | VARCHAR(191) | FK → Tenant, INDEX |
| name | VARCHAR(191) | |
| email | VARCHAR(191) | UNIQUE(tenantId, email) |
| passwordHash | VARCHAR(191) | bcryptjs 10 rounds, **nunca sai na API** |
| role | ENUM | ADMIN, MANAGER, OPERATOR |
| status | ENUM | ACTIVE, SUSPENDED |
| mfaSecret | VARCHAR(191) | Cifrado AES-256-GCM |
| mfaEnabled | Boolean | |
| createdAt | DATETIME(3) | |
| updatedAt | DATETIME(3) | |

### OAuthAccount

Vinculação de contas OAuth (Google/GitHub) ao usuário local.

### RefreshToken

Tokens opacos (hash SHA-256 no banco). Rotação a cada uso.

### Customer

| Campo | Tipo | Notas |
|---|---|---|
| id | VARCHAR(191) | PK, UUID |
| tenantId | VARCHAR(191) | FK → Tenant, INDEX |
| name | VARCHAR(191) | |
| document | VARCHAR(191) | CPF/CNPJ (opcional) |
| cep | VARCHAR(8) | ViaCEP (opcional, INDEX tenantId+cep) |
| email | VARCHAR(191) | |
| phone | VARCHAR(191) | |
| city | VARCHAR(191) | |
| state | VARCHAR(191) | |
| status | ENUM | ACTIVE, INACTIVE |
| createdAt | DATETIME(3) | |
| updatedAt | DATETIME(3) | |

### Carrier

Transportadora com parâmetros de precificação.

| Campo | Tipo | Notas |
|---|---|---|
| baseFee | DECIMAL(12,2) | Taxa base do frete |
| pricePerKg | DECIMAL(12,2) | Preço por kg |
| pricePerKm | DECIMAL(12,4) | Preço por km |
| riskPercent | DECIMAL(5,4) | Percentual de risco sobre valor da carga |
| cubingFactor | INT | Fator de cubagem (padrão 6000) |

### FreightSimulation

Simulação de frete com cotações. `selectedCarrierId` opcional (transportadora escolhida).

### SimulationQuote

Cotação por transportadora dentro de uma simulação. `isCheapest` marca a menor.

### Import

Importação assíncrona de arquivos. Estados: PENDING → PROCESSING → COMPLETED/FAILED.

### AuditLog

Registros de auditoria com metadata sanitizada (nunca secrets/tokens).

### Insight

Insights gerados por regras determinísticas. Tipos: economy, carrier, concentration, trend.

---

## Multi-tenancy

Todas as queries filtram por `tenantId` obtido do JWT. Recurso de outro tenant → 404.

## Índices críticos

- `User(tenantId)`, `User(tenantId, email)` — login e listagem por tenant
- `Customer(tenantId)`, `Customer(tenantId, status)` — CRUD filtrado
- `Carrier(tenantId)`, `Carrier(tenantId, active)` — listagem ativa
- `FreightSimulation(tenantId)`, `FreightSimulation(tenantId, createdAt)` — histórico
- `SimulationQuote(simulationId)`, `SimulationQuote(carrierId)` — cotações
- `Import(tenantId)`, `Import(tenantId, status)` — acompanhamento imports
- `AuditLog(tenantId, createdAt)`, `AuditLog(tenantId, action)` — auditoria
- `Insight(tenantId)` — insights

---

## Migrations

| Migration | Descrição |
|---|---|
| 0001_init | Schema inicial (todos os modelos) |
| 0002_add_customer_cep | Campo `cep` no Customer + índice composto |
