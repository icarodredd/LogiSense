# LogiSense

> Plataforma SaaS multi-tenant para inteligência logística, comparação de fretes e tomada de decisão operacional.

[![Stack](https://img.shields.io/badge/stack-NestJS%20%2B%20Next.js-587A91)](#stack)
[![Database](https://img.shields.io/badge/database-MySQL-587A91)](#infraestrutura-local)
[![Tests](https://img.shields.io/badge/backend-tests-122-6C9B82)](#testes-e-qualidade)

## Visão geral

A LogiSense foi construída para o desafio técnico de uma plataforma de inteligência logística. A proposta não é apenas calcular um frete: é centralizar clientes, transportadoras, simulações, histórico e indicadores para que equipes comparem alternativas e encontrem oportunidades de economia com contexto.

O produto é um SaaS B2B multi-tenant. Cada empresa possui um workspace isolado, usuários com papéis distintos e dados próprios. A aplicação combina uma landing page pública com uma plataforma administrativa autenticada.

### O problema

Decisões de transporte frequentemente ficam espalhadas em planilhas, e-mails e sistemas sem comparação histórica. Isso dificulta responder:

- Qual transportadora é mais competitiva em uma rota?
- Quanto uma alternativa poderia economizar?
- Quais rotas concentram o maior volume?
- O custo médio está subindo ou caindo?
- Quem alterou uma informação administrativa?

### A solução

O LogiSense organiza esse fluxo em uma experiência única:

```text
Clientes + Transportadoras
            ↓
      Simulação de frete
            ↓
 Comparação + Histórico
            ↓
 Dashboard + Insights
            ↓
 Decisão operacional rastreável
```

## Status do desafio

| Área avaliada no desafio                           | Implementação                                              |
| -------------------------------------------------- | ---------------------------------------------------------- |
| Backend NestJS + TypeScript                        | Implementado                                               |
| Frontend Next.js + TypeScript                      | Implementado                                               |
| MySQL + Prisma                                     | Implementado                                               |
| Redis + Docker Compose                             | Implementado                                               |
| Landing page pública                               | Implementado                                               |
| Área autenticada com RBAC                          | Implementado                                               |
| Multi-tenancy com isolamento                       | Implementado                                               |
| Usuários, clientes e transportadoras               | Implementado                                               |
| Simulações e histórico                             | Implementado                                               |
| Dashboard baseado em dados persistidos             | Implementado                                               |
| Insights determinísticos                           | Implementado                                               |
| Duas APIs externas                                 | Implementado: ViaCEP e Open-Meteo                          |
| Upload CSV/XLSX                                    | Implementado                                               |
| Processamento assíncrono                           | Implementado com BullMQ                                    |
| Atualização em tempo real                          | Implementado com Socket.IO                                 |
| E-mail/senha, OAuth, MFA/TOTP, JWT e refresh token | Implementado                                               |
| Auditoria e observabilidade                        | Implementado                                               |
| Testes automatizados                               | Implementado                                               |
| Deploy público                                     | Preparado, mas depende da escolha/configuração do provedor |

O documento original do desafio está disponível no ambiente de avaliação como `desafio_tecnico_logistica.pdf`. Este README descreve as decisões tomadas para atender aos requisitos e como reproduzir o projeto.

## Funcionalidades

### Landing page pública

A landing apresenta a proposta de valor, o problema operacional, os módulos, o fluxo de uso, diferenciais de segurança e uma demonstração visual do produto. Ela é responsiva, possui identidade própria, navegação por âncoras, transições CSS e CTAs que respeitam a sessão:

- visitante sem sessão → `/login`;
- usuário autenticado → `/dashboard`.

### Plataforma restrita

Rotas principais da aplicação:

| Rota                   | Finalidade                                               |
| ---------------------- | -------------------------------------------------------- |
| `/dashboard`           | Indicadores, evolução de custos, rotas e transportadoras |
| `/customers`           | Gestão de clientes                                       |
| `/carriers`            | Gestão de transportadoras e parâmetros de preço          |
| `/simulations/new`     | Criação de simulação comparativa                         |
| `/simulations/history` | Histórico e busca de simulações                          |
| `/simulations/:id`     | Detalhe e comparação das cotações                        |
| `/imports`             | Upload, status e progresso de importações                |
| `/insights`            | Insights analíticos por severidade                       |
| `/users`               | Gestão de usuários, para perfis autorizados              |
| `/audit`               | Consulta de eventos de auditoria                         |
| `/settings`            | Configurações do usuário e MFA                           |

Todas as telas de negócio consideram estados de loading, erro, vazio, sucesso e acesso negado conforme o contexto da operação.

### Papéis e permissões

| Recurso                       | ADMIN |      MANAGER      | OPERATOR |
| ----------------------------- | :---: | :---------------: | :------: |
| Dashboard                     |   ✓   |         ✓         |    ✓     |
| Criar e consultar simulações  |   ✓   |         ✓         |    ✓     |
| Gerenciar clientes            |   ✓   |         ✓         | consulta |
| Gerenciar transportadoras     |   ✓   |         ✓         | consulta |
| Criar e consultar importações |   ✓   |         ✓         | consulta |
| Insights                      |   ✓   |         ✓         |    ✓     |
| Gestão de usuários            |   ✓   |         —         |    —     |
| Auditoria                     |   ✓   | conforme política |    —     |
| MFA da própria conta          |   ✓   |         ✓         |    ✓     |

O frontend oculta ações inadequadas para melhorar a experiência, mas a autorização real é sempre executada no backend por guards e decorators.

## Stack

| Camada         | Tecnologias                                       | Decisão                                           |
| -------------- | ------------------------------------------------- | ------------------------------------------------- |
| Web            | Next.js 16, React 19, TypeScript                  | App Router, páginas públicas e restritas          |
| API            | Node.js, NestJS 12, TypeScript                    | Monólito modular com separação por domínio        |
| Persistência   | MySQL 8.4, Prisma 6                               | Schema compartilhado e `tenantId`                 |
| Fila           | Redis 7, BullMQ                                   | Jobs de importação fora do ciclo HTTP             |
| Tempo real     | Socket.IO                                         | Progresso de importação por sala                  |
| Autenticação   | JWT, cookies HttpOnly, bcryptjs, OAuth, otplib    | Sessões curtas, refresh rotativo e MFA            |
| UI             | CSS próprio, Tailwind 4, shadcn/ui, Radix, Lucide | Identidade visual e componentes acessíveis        |
| Qualidade      | Vitest, Supertest, ESLint, oxlint                 | Unitários, E2E e validação estática               |
| Infraestrutura | Docker, Docker Compose                            | Ambiente reproduzível com MySQL, Redis, API e Web |

## Arquitetura

Foi escolhido um **monólito modular**, em vez de microserviços, porque o domínio ainda é coeso, o desafio exige velocidade de entrega e a separação por módulos já fornece limites claros sem adicionar complexidade operacional desnecessária.

```text
LogiSense
├── backend/
│   ├── src/
│   │   ├── common/             # guards, decorators, filtros, logs, paginação
│   │   ├── config/             # configuração tipada e validação de ambiente
│   │   ├── database/           # Prisma e Redis
│   │   ├── modules/
│   │   │   ├── auth/           # senha, JWT, refresh, OAuth e MFA
│   │   │   ├── users/          # usuários e RBAC
│   │   │   ├── tenants/        # contexto da empresa
│   │   │   ├── customers/      # clientes
│   │   │   ├── carriers/       # transportadoras
│   │   │   ├── simulations/    # simulações e cotações
│   │   │   ├── freight/        # cálculo de frete
│   │   │   ├── dashboard/      # agregações de negócio
│   │   │   ├── insights/       # regras analíticas
│   │   │   ├── imports/        # upload e processamento
│   │   │   ├── integrations/   # ViaCEP e Open-Meteo
│   │   │   ├── audit/          # rastreabilidade
│   │   │   └── health/         # saúde de MySQL e Redis
│   │   ├── queue/              # BullMQ e processor
│   │   ├── websocket/          # Socket.IO e autorização de salas
│   │   └── main.ts
│   └── prisma/
│       ├── schema.prisma
│       ├── migrations/
│       └── seed.ts
├── frontend/
│   ├── app/                    # App Router e páginas
│   ├── components/             # componentes compartilhados
│   └── lib/api.ts              # cliente HTTP tipado
├── docs/                       # arquitetura, fluxos e ADRs
├── docker-compose.yml
└── README.md
```

### Fluxo de uma requisição

```text
HTTP request
  → RequestIdMiddleware
  → ThrottlerGuard
  → JwtAuthGuard
  → RolesGuard
  → Controller + DTO/ValidationPipe
  → Service / caso de uso
  → Prisma ou Redis
  → Presenter / resposta padronizada
  → LoggingInterceptor
```

Controllers cuidam do protocolo HTTP. Services concentram regras de negócio. DTOs validam a entrada. Presenters controlam a saída. O domínio não recebe `Request` diretamente: contexto de auditoria e identidade são passados de forma explícita.

## Multi-tenancy e isolamento

A estratégia adotada é:

```text
shared database + shared schema + tenant_id
```

Todas as entidades de negócio possuem vínculo com `Tenant`. O tenant atual não vem do frontend, query string, body ou header: ele é derivado do usuário autenticado.

```text
cookie ls_access / Bearer JWT
        ↓
JwtAuthGuard valida assinatura, expiração e usuário ativo
        ↓
req.user = { id, tenantId, email, role }
        ↓
Services aplicam tenantId em toda leitura e escrita
```

Exemplos de proteção:

- `findFirst({ where: { id, tenantId } })` para buscar recurso;
- listagens sempre filtradas por `tenantId`;
- criações usam o tenant da identidade, nunca um valor enviado pelo cliente;
- recurso de outro tenant responde 404 para não confirmar sua existência;
- worker de importação revalida o tenant antes de processar;
- salas Socket.IO validam posse da importação.

Essa decisão privilegia simplicidade operacional, custo baixo e consistência transacional. A alternativa de banco/schema por tenant seria considerada em escala muito maior, mas aumentaria provisionamento, migrações e complexidade de operação para o escopo do desafio.

Detalhes: [`docs/multi-tenancy.md`](docs/multi-tenancy.md), [`docs/database.md`](docs/database.md).

## Domínio e cálculo de frete

O modelo principal é:

```text
Tenant
 ├── User
 ├── Customer
 ├── Carrier
 ├── FreightSimulation
 │    └── SimulationQuote
 ├── Import
 ├── Insight
 └── AuditLog
```

Cada simulação recebe origem, destino, peso, dimensões e valor da carga. Para cada transportadora aplicável, o serviço calcula uma cotação independente.

O cálculo é determinístico e explicável:

```text
pesoCubado = comprimento × largura × altura / fatorCubagem
pesoConsiderado = max(pesoReal, pesoCubado)

freteBase = taxaBase + (pesoConsiderado × tarifaPorKg)
adicionalDistancia = distância × tarifaPorKm
adicionalRisco = valorDaCarga × percentualDeRisco

freteTotal = freteBase + adicionalDistancia + adicionalRisco
```

A distância é resolvida pelo domínio de rotas disponível no projeto, sem fingir uma cotação comercial real de uma transportadora. A resposta informa custo total, adicionais, prazo estimado e identifica a alternativa mais barata.

## Dashboard e insights

O dashboard consulta agregações persistidas no backend, sem números hardcoded:

- quantidade de simulações;
- frete médio, mínimo e máximo;
- economia potencial;
- transportadoras utilizadas;
- rotas mais frequentes;
- evolução semanal do custo;
- custo médio por transportadora.

Os insights são regras determinísticas e explicáveis:

| Tipo           | Exemplo                                                         |
| -------------- | --------------------------------------------------------------- |
| Economia       | diferença acumulada entre a cotação escolhida e a menor cotação |
| Transportadora | comparação de custo médio por transportadora                    |
| Concentração   | participação de uma rota no total de simulações                 |
| Tendência      | variação do custo médio entre períodos                          |

Isso evita gerar recomendações aleatórias ou atribuir ao produto uma IA generativa que não existe.

## Autenticação e segurança

### Sessões

- login por e-mail e senha;
- senhas com bcryptjs, nunca persistidas em texto puro;
- access token JWT de curta duração em cookie `HttpOnly`;
- refresh token opaco, armazenado somente como hash SHA-256;
- rotação e revogação de refresh token;
- cookies `SameSite=Lax` e `Secure` em produção;
- endpoint `/api/auth/me` para validar a sessão atual;
- redirecionamento da landing e do dashboard quando a sessão não existe.

### OAuth

Google e GitHub usam Authorization Code com `state` aleatório, armazenado no Redis com TTL e uso único. O callback valida o estado, resolve o e-mail verificado, vincula a conta local e cria a sessão.

### MFA/TOTP

1. usuário autenticado inicia setup;
2. backend gera URI e QR Code;
3. segredo pendente é confirmado por código TOTP;
4. segredo é cifrado em repouso com AES-256-GCM;
5. logins futuros exigem o código;
6. desativação exige senha e TOTP.

### Proteção contra abuso

- throttling global;
- rate limit específico para login;
- rate limit para confirmação/desativação de MFA;
- mensagens genéricas para credenciais inválidas;
- Helmet e CORS configurados no bootstrap;
- validação estrita com `whitelist` e `forbidNonWhitelisted`;
- auditoria sanitizada, sem tokens, senhas ou secrets.

Detalhes: [`docs/authentication.md`](docs/authentication.md) e [`docs/decisions/003-authentication.md`](docs/decisions/003-authentication.md).

## Upload, processamento assíncrono e tempo real

Importações CSV/XLSX não bloqueiam a requisição principal:

```text
Frontend
  → POST /api/imports
  → metadados PENDING + job BullMQ
  → resposta imediata
  → worker Redis processa em lotes
  → banco recebe progresso/status
  → Socket.IO emite eventos por importId
  → frontend atualiza a tela
```

Características:

- limite de 10 MB;
- extensões e MIME types validados;
- estados `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`;
- retry com backoff exponencial;
- upsert idempotente por chave de negócio;
- processamento em lotes;
- falhas registradas em auditoria;
- arquivo removido após o processamento;
- autorização por tenant no worker e na sala WebSocket.

Tipos processados:

- `CUSTOMERS`: campos de cliente e cabeçalhos em português;
- `CARRIERS`: parâmetros de precificação;
- `SIMULATIONS`: reservado e rejeitado com erro explícito até existir um contrato de importação completo.

Detalhes: [`docs/async-processing.md`](docs/async-processing.md).

## Integrações externas

O frontend não chama provedores diretamente. O backend encapsula, valida e normaliza as respostas:

| Provedor   | Endpoint interno                          | Uso                                   |
| ---------- | ----------------------------------------- | ------------------------------------- |
| ViaCEP     | `GET /api/integrations/cep/:cep`          | preenchimento e validação de endereço |
| Open-Meteo | `GET /api/integrations/weather?lat=&lon=` | contexto climático operacional        |

Ambas são APIs públicas e não exigem secrets. Erros externos são convertidos para o envelope padrão da API.

Detalhes: [`docs/external-integrations.md`](docs/external-integrations.md).

## Auditoria e observabilidade

Eventos relevantes são registrados com tenant, usuário, ação, entidade, metadata sanitizada, IP, user-agent, request ID e timestamp. Exemplos:

```text
LOGIN
LOGOUT
TENANT_CREATED
USER_CREATED
ROLE_CHANGED
CUSTOMER_CREATED
CARRIER_CREATED
SIMULATION_CREATED
IMPORT_STARTED
IMPORT_COMPLETED
IMPORT_FAILED
MFA_ENABLED
```

Observabilidade:

- logs estruturados com Pino;
- `x-request-id` gerado ou propagado;
- método, rota, status e duração em cada requisição;
- filtro global de exceções;
- respostas sem stack trace ou detalhes internos;
- `GET /api/health` verifica MySQL e Redis;
- `requestId` permite correlacionar erro HTTP e log do servidor.

Envelope de erro:

```json
{
  "statusCode": 400,
  "code": "INVALID_CEP",
  "message": "O CEP informado é inválido.",
  "timestamp": "2026-09-16T12:00:00.000Z",
  "requestId": "abc123"
}
```

## API principal

Todas as rotas usam o prefixo `/api`.

| Grupo        | Rotas principais                                                               |
| ------------ | ------------------------------------------------------------------------------ |
| Health       | `GET /health`                                                                  |
| Auth         | `POST /auth/register`, `/login`, `/refresh`, `/logout`; `GET /auth/me`         |
| OAuth        | `GET /auth/google/authorize`, `/callback`; GitHub equivalente                  |
| MFA          | `POST /auth/mfa/setup`, `/confirm`, `/disable`                                 |
| Users        | `GET/POST /users`, `GET/PATCH/DELETE /users/:id`                               |
| Tenants      | `GET /tenants/me`                                                              |
| Customers    | `GET/POST /customers`, `PATCH/DELETE /customers/:id`                           |
| Carriers     | `GET/POST /carriers`, `PATCH/DELETE /carriers/:id`                             |
| Simulations  | `POST /simulations`, `GET /simulations`, `GET /simulations/:id`, histórico     |
| Dashboard    | `GET /dashboard/overview`, `/carriers`, `/routes`                              |
| Insights     | `GET /insights`, `POST /insights/regenerate`                                   |
| Imports      | `POST /imports`, `GET /imports`, `GET /imports/:id`, `POST /imports/:id/retry` |
| Audit        | `GET /audit`                                                                   |
| Integrations | `GET /integrations/cep/:cep`, `/weather`                                       |

Paginação segue `?page=&limit=` e retorna `data` e `meta`. O limite máximo é 100.

## Execução local

### Pré-requisitos

- Node.js 22 ou superior;
- pnpm 10 ou superior;
- Docker e Docker Compose.

### Subir o ambiente completo

```bash
cp .env.example .env
docker compose up -d --build
curl http://localhost:3001/api/health
```

Aplicações:

- Web: <http://localhost:3000>
- API: <http://localhost:3001/api>
- Health: <http://localhost:3001/api/health>

O Compose inicia MySQL, Redis, API e frontend. A API aplica migrations no boot; o seed deve ser executado quando for necessário recriar os dados de demonstração:

```bash
docker compose exec api pnpm exec prisma db seed
```

Para desenvolvimento com sincronização:

```bash
docker compose watch
```

### Executar serviços fora do Compose

Consulte:

- [`backend/README.md`](backend/README.md)
- [`frontend/README.md`](frontend/README.md)

### Variáveis de ambiente

Nunca versione `.env`. Use:

```bash
cp .env.example .env
```

Em produção, substitua obrigatoriamente:

- `JWT_ACCESS_SECRET`;
- `MFA_ENCRYPTION_KEY`;
- `DATABASE_URL`;
- `REDIS_URL`;
- `CORS_ORIGINS`;
- `FRONTEND_URL`;
- callbacks e credenciais OAuth;
- `COOKIE_SECURE=true`.

## Testes e qualidade

### Backend

```bash
cd backend
pnpm test
pnpm test:e2e
pnpm lint
pnpm build
```

O conjunto unitário cobre autenticação, tokens, MFA, OAuth, RBAC, CRUDs, isolamento, cálculo de frete, dashboard, insights, integrações, import worker, auditoria e WebSocket. O estado atual documentado é de **122 testes em 20 arquivos unitários**.

E2E com banco real:

```bash
cd backend
RUN_DB_TESTS=true DATABASE_URL='mysql://usuario:senha@localhost:3306/logisense' pnpm test:e2e
```

### Frontend

```bash
cd frontend
pnpm lint
pnpm build
```

### Critérios usados

- regras de negócio testadas em isolamento;
- filtros de `tenantId` verificados;
- erros representados por códigos estáveis;
- controllers sem regra de negócio;
- validação na borda;
- sem secrets em logs, respostas ou auditoria;
- build e lint como gate de entrega.

Detalhes: [`docs/testing.md`](docs/testing.md).

## Decisões técnicas

As decisões relevantes estão registradas em ADRs:

| ADR                                           | Decisão                                       |
| --------------------------------------------- | --------------------------------------------- |
| [001](docs/decisions/001-monolith-modular.md) | Monólito modular em vez de microserviços      |
| [002](docs/decisions/002-multi-tenancy.md)    | Banco/schema compartilhado com `tenant_id`    |
| [003](docs/decisions/003-authentication.md)   | JWT em cookies, refresh rotativo, OAuth e MFA |
| [004](docs/decisions/004-async-processing.md) | BullMQ/Redis para importações assíncronas     |
| [005](docs/decisions/005-storage-strategy.md) | Estratégia de armazenamento de arquivos       |

Documentação complementar:

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/database.md`](docs/database.md)
- [`docs/multi-tenancy.md`](docs/multi-tenancy.md)
- [`docs/authentication.md`](docs/authentication.md)
- [`docs/async-processing.md`](docs/async-processing.md)
- [`docs/external-integrations.md`](docs/external-integrations.md)
- [`docs/testing.md`](docs/testing.md)

## Estrutura de documentação

```text
docs/
├── architecture.md
├── database.md
├── multi-tenancy.md
├── authentication.md
├── async-processing.md
├── external-integrations.md
├── testing.md
└── decisions/
    ├── 001-monolith-modular.md
    ├── 002-multi-tenancy.md
    ├── 003-authentication.md
    ├── 004-async-processing.md
    └── 005-storage-strategy.md
```

Os artefatos de contexto e desenvolvimento assistido por IA permanecem no repositório em [`AGENTS.md`](AGENTS.md) e [`frontend/AGENTS.md`](frontend/AGENTS.md), conforme solicitado pelo desafio.

## Licença

Projeto privado desenvolvido para avaliação técnica.
