# LogiSense — Contexto de Produto e Diretrizes de Implementação

## 1. Objetivo deste arquivo

Este arquivo é a fonte principal de contexto para agentes de desenvolvimento que trabalham neste repositório.

O objetivo é orientar a implementação de uma plataforma SaaS multi-tenant de inteligência logística, criada para o desafio técnico descrito no documento `desafio_tecnico_logistica.pdf`.

O agente deve usar este documento para entender:

- o produto que está sendo construído;
- os requisitos obrigatórios do desafio;
- as decisões de produto e arquitetura já adotadas;
- as regras de domínio;
- os critérios de qualidade esperados;
- o que deve e não deve ser priorizado.

Quando houver conflito entre este documento e uma solicitação explícita do usuário, a solicitação explícita do usuário prevalece.

---

# 2. Produto

## Nome

**LogiSense**

## Categoria

SaaS B2B de inteligência logística e análise de fretes.

## Proposta de valor

A LogiSense ajuda empresas a analisar custos de transporte, comparar alternativas de frete, acompanhar sua operação e identificar oportunidades de economia por meio dos dados logísticos disponíveis.

A calculadora de fretes não é o produto inteiro. Ela é um dos módulos centrais dentro de uma plataforma maior de inteligência logística.

## Problema que o produto resolve

Empresas podem ter dificuldade para:

- comparar custos entre transportadoras;
- identificar quais rotas geram maior custo;
- entender a evolução do gasto com fretes;
- encontrar oportunidades de economia;
- centralizar clientes, transportadoras e simulações;
- acompanhar operações provenientes de importações de arquivos;
- rastrear ações administrativas.

## Público-alvo

Empresas que possuem operação logística própria ou que precisam analisar e controlar seus custos de transporte.

O produto é B2B e multi-tenant: cada empresa é um tenant independente dentro da mesma aplicação.

---

# 3. Requisitos obrigatórios do desafio

Os requisitos abaixo são considerados obrigatórios e não devem ser removidos sem decisão explícita.

## Stack obrigatória

### Backend

- Node.js
- NestJS
- TypeScript

### Frontend

- Next.js
- TypeScript

### Banco

- MySQL

### Infraestrutura

- Docker
- Docker Compose
- Redis

## Produto

Deve existir:

- landing page pública;
- plataforma administrativa/restrita;
- autenticação;
- diferentes níveis de acesso;
- multi-tenancy com isolamento de dados;
- gestão de usuários;
- gestão de clientes;
- gestão de transportadoras;
- simulação de fretes;
- histórico de simulações;
- dashboard;
- geração automática de insights;
- pelo menos duas APIs externas;
- upload de arquivos relacionados à operação logística;
- pelo menos uma funcionalidade com processamento assíncrono;
- pelo menos um fluxo de comunicação em tempo real.

## Segurança obrigatória

- login por e-mail e senha;
- Google OAuth;
- GitHub OAuth;
- MFA/TOTP;
- JWT;
- refresh token;
- controle de acesso por perfil;
- proteção contra abuso de autenticação.

## Auditoria

Ações relevantes precisam ser registradas para rastreabilidade, incluindo pelo menos conceitos equivalentes a:

- login;
- logout;
- criação de usuários;
- alteração de permissões;
- operações administrativas.

## Qualidade

A solução deve demonstrar:

- arquitetura organizada;
- separação de responsabilidades;
- casos de uso;
- serviços;
- controllers;
- decorators;
- presenters quando fizer sentido;
- DTOs;
- validações;
- tratamento de erros;
- testes automatizados;
- observabilidade;
- documentação;
- versão publicada para demonstração.

---

# 4. Princípios de produto

## 4.1. O produto deve parecer um SaaS real

Não implementar as funcionalidades como uma coleção de telas independentes.

Todas as áreas devem fazer parte de uma mesma experiência:

`Clientes -> Transportadoras -> Simulações -> Histórico -> Dashboard -> Insights`

## 4.2. Dados reais do sistema

Dashboard e insights devem ser derivados dos dados persistidos. Não usar números hardcoded para simular uma plataforma funcional.

## 4.3. Segurança deve existir no backend

Esconder botões no frontend não substitui autorização no backend.

O backend deve validar:

- autenticação;
- tenant;
- permissão;
- acesso ao recurso.

## 4.4. Multi-tenancy é uma regra de segurança

Toda consulta de negócio precisa respeitar o tenant autenticado.

Nunca confiar em `tenantId` enviado pelo frontend para definir o tenant atual.

## 4.5. UX deve comunicar estado

Toda operação relevante deve possuir estados claros de:

- loading;
- sucesso;
- erro;
- vazio;
- processamento.

---

# 5. Conceito visual

A interface deve transmitir:

- tecnologia;
- confiança;
- eficiência;
- inteligência operacional;
- produto B2B premium.

Evitar aparência de template genérico de dashboard.

A identidade visual deve ser própria e consistente entre landing page e aplicação.

## Landing page

Narrativa recomendada:

1. Mostrar o problema do controle de custos logísticos.
2. Apresentar a LogiSense como camada de inteligência.
3. Mostrar comparação de fretes.
4. Mostrar indicadores e economia.
5. Mostrar insights automáticos.
6. Apresentar a plataforma visualmente.
7. Conduzir o visitante para a aplicação.

A landing deve possuir:

- design moderno;
- responsividade;
- animações/transições;
- storytelling visual;
- sessões de benefícios;
- diferenciais do produto.

---

# 6. Personas e níveis de acesso

Os perfis principais são:

## ADMIN

Responsável pela administração da empresa.

Pode:

- gerenciar usuários;
- alterar permissões;
- gerenciar clientes;
- gerenciar transportadoras;
- executar simulações;
- consultar dashboard;
- consultar auditoria;
- executar operações administrativas.

## MANAGER

Responsável pela operação/gestão.

Pode:

- consultar e gerenciar clientes;
- consultar e gerenciar transportadoras;
- executar simulações;
- consultar histórico;
- consultar dashboard;
- consultar insights;
- consultar auditoria quando permitido pela política de acesso.

Não deve administrar permissões globais de usuários, salvo decisão explícita posterior.

## OPERATOR

Usuário operacional.

Pode:

- consultar clientes;
- consultar transportadoras;
- executar simulações;
- consultar histórico próprio ou permitido pela política do tenant.

Não pode:

- alterar permissões;
- executar operações administrativas restritas.

As permissões devem ser verificadas no backend.

---

# 7. Multi-tenancy

## Estratégia adotada

**Shared database + shared schema + `tenant_id`.**

Cada entidade de negócio que pertence a uma empresa deve possuir referência ao tenant.

Exemplo conceitual:

```text
Tenant
 ├── Users
 ├── Customers
 ├── Carriers
 ├── FreightSimulations
 ├── Imports
 ├── AuditLogs
 └── Insights
```

## Regra crítica

O tenant atual deve ser obtido a partir da identidade autenticada.

Fluxo:

```text
JWT / sessão
    -> usuário autenticado
    -> tenantId
    -> regra de autorização
    -> consulta filtrada pelo tenantId
```

Não criar APIs em que o cliente consiga escolher livremente o tenant através de query parameter/body para acessar dados.

## Objetivo de segurança

Um usuário do Tenant A jamais pode acessar dados do Tenant B, mesmo que tente manipular IDs, URLs, payloads ou parâmetros.

Casos de teste de isolamento devem existir.

---

# 8. Domínio principal

## 8.1. Tenant

Representa uma empresa cliente da plataforma.

Campos conceituais:

- id;
- name;
- slug;
- createdAt;
- updatedAt.

## 8.2. User

Usuário interno de um tenant.

Campos conceituais:

- id;
- tenantId;
- name;
- email;
- passwordHash quando aplicável;
- role;
- status;
- createdAt;
- updatedAt.

## 8.3. Customer

Cliente comercial/operacional da empresa.

Campos conceituais:

- id;
- tenantId;
- name;
- document quando aplicável;
- email;
- phone;
- address;
- status;
- createdAt;
- updatedAt.

## 8.4. Carrier

Transportadora usada nas simulações.

Campos conceituais:

- id;
- tenantId;
- name;
- document quando aplicável;
- contact information;
- pricing/configuration fields;
- active;
- createdAt;
- updatedAt.

## 8.5. FreightSimulation

Representa uma tentativa de estimar/comparar custos de transporte.

Entrada mínima:

- origem;
- destino;
- peso;
- comprimento;
- largura;
- altura;
- valor da carga.

Campos adicionais recomendados:

- userId;
- customerId;
- selectedCarrierId quando aplicável;
- distance;
- volumetricWeight;
- chargeableWeight;
- status;
- createdAt.

## 8.6. SimulationQuote

Representa uma cotação resultante de uma simulação para uma transportadora específica.

Exemplo:

```text
Simulação #123

Transportadora A -> R$ 820
Transportadora B -> R$ 760
Transportadora C -> R$ 915
```

Campos conceituais:

- id;
- simulationId;
- carrierId;
- freightCost;
- estimatedDeliveryDays;
- additionalFees;
- totalCost;
- createdAt.

Essa separação permite comparar transportadoras dentro de uma mesma simulação.

## 8.7. Import

Representa um arquivo enviado para processamento assíncrono.

Estados esperados:

- PENDING;
- PROCESSING;
- COMPLETED;
- FAILED.

Informações úteis:

- tenantId;
- userId;
- filename;
- type;
- size;
- status;
- totalRows;
- processedRows;
- errorMessage;
- createdAt;
- completedAt.

## 8.8. AuditLog

Registra ações relevantes.

Campos conceituais:

- id;
- tenantId;
- userId;
- action;
- entity;
- entityId;
- metadata;
- ip;
- userAgent;
- requestId;
- createdAt.

## 8.9. Insight

Resultado de uma regra analítica aplicada aos dados do tenant.

Campos conceituais:

- id;
- tenantId;
- type;
- title;
- description;
- severity/prioridade;
- metadata;
- createdAt.

---

# 9. Simulação de frete

## Objetivo

Permitir que o usuário compare possíveis custos de transporte considerando características da carga e da rota.

## Entradas mínimas

- origem;
- destino;
- peso;
- dimensões;
- valor da carga.

## Modelo de cálculo recomendado

A lógica deve ser determinística e documentada.

Conceito sugerido:

```text
pesoCubado = comprimento * largura * altura / fatorCubagem

pesoConsiderado = max(pesoReal, pesoCubado)

freteBase = pesoConsiderado * tarifaPorKg

adicionalDistancia = distancia * tarifaPorKm

adicionalValor = valorDaCarga * percentualDeRisco

freteTotal =
    freteBase
    + adicionalDistancia
    + adicionalValor
```

Os fatores e regras numéricas reais podem ser definidos durante a implementação, desde que sejam consistentes, testáveis e documentados.

Também podem existir regras como:

- adicional por longa distância;
- adicional para carga de alto valor;
- desconto por faixa de peso;
- prazo estimado por faixa de distância.

Não fingir integração com preços reais de transportadoras se isso não estiver implementado.

---

# 10. Histórico

Cada simulação concluída deve ser persistida e consultável.

A tela deve permitir pelo menos:

- listagem;
- paginação;
- busca/filtro;
- visualização dos dados da simulação;
- comparação das cotações;
- identificação da alternativa de menor custo.

---

# 11. Dashboard

O dashboard deve responder perguntas de negócio, não apenas exibir gráficos.

Indicadores recomendados:

- quantidade de simulações;
- frete médio;
- menor frete encontrado;
- maior frete encontrado;
- economia potencial;
- quantidade de transportadoras utilizadas;
- rotas mais simuladas;
- tendência de custo ao longo do tempo.

Visualizações possíveis:

- evolução de custos;
- custo por transportadora;
- distribuição por rota;
- comparação entre transportadoras;
- economia potencial.

Os números precisam ser calculados a partir do banco.

---

# 12. Insights automáticos

Não é necessário utilizar IA generativa.

Preferir regras determinísticas e explicáveis.

Exemplos:

### Economia

```text
A alternativa mais econômica poderia reduzir seus custos em R$ 8.420 nas últimas 50 simulações.
```

### Transportadora

```text
A Transportadora X apresentou custo médio 12% menor nas rotas analisadas para determinada região.
```

### Concentração de rotas

```text
A rota São Paulo -> Fortaleza representa 21% das suas simulações recentes.
```

### Tendência

```text
O custo médio de frete caiu 8,4% nas últimas quatro semanas.
```

Os insights devem informar a origem dos dados quando isso melhorar a confiança do usuário.

---

# 13. Integrações externas

É obrigatório consumir pelo menos duas APIs externas.

Integrações recomendadas para o produto:

## ViaCEP

Uso:

- consulta de endereço por CEP;
- preenchimento de formulários;
- validação/normalização de endereço.

## Open-Meteo

Uso:

- consulta de condições/previsão associadas a origem ou destino;
- geração de contexto operacional;
- possibilidade de produzir um indicador de risco climático simples.

As integrações devem ser encapsuladas no backend. O frontend não deve depender diretamente dos providers externos para regras críticas de negócio.

As APIs externas podem ser substituídas por outras equivalentes caso isso melhore confiabilidade, disponibilidade ou coerência do produto.

---

# 14. Upload e processamento assíncrono

## Objetivo

Permitir importação de arquivos relacionados à operação logística.

Formatos mínimos esperados:

- CSV;
- XLSX.

## Arquitetura recomendada

```text
Frontend
   -> POST upload
Backend
   -> salva metadados
   -> cria job
Redis / BullMQ
   -> worker
Worker
   -> lê arquivo
   -> valida dados
   -> processa registros
   -> atualiza progresso/status
WebSocket
   -> envia progresso
Frontend
   -> atualiza UI em tempo real
```

## Estados

```text
PENDING
PROCESSING
COMPLETED
FAILED
```

## Requisitos de qualidade

- validação de extensão/tipo/tamanho;
- tratamento de arquivo inválido;
- não bloquear a requisição durante processamento pesado;
- registrar falhas;
- permitir visualizar progresso;
- tornar o processamento idempotente quando possível.

---

# 15. Comunicação em tempo real

O fluxo principal recomendado é o acompanhamento do processamento de importação.

Exemplo de evento:

```json
{
  "importId": "uuid",
  "status": "PROCESSING",
  "processed": 720,
  "total": 1500,
  "percentage": 48
}
```

Socket.IO é a opção recomendada.

O WebSocket deve ter uma função real no produto e não existir apenas para cumprir requisito.

---

# 16. Autenticação e segurança

## Login

Fluxo esperado:

```text
email + senha
    -> valida credenciais
    -> verifica MFA se habilitado
    -> gera access token
    -> disponibiliza refresh token
```

## Tokens

Recomendação:

- access token de curta duração;
- refresh token de maior duração;
- cookies HttpOnly quando a arquitetura escolhida permitir;
- Secure em produção;
- política SameSite adequada.

Nunca armazenar senhas em texto puro.

## OAuth

Obrigatório:

- Google;
- GitHub.

Associar contas OAuth ao usuário local através de uma estrutura equivalente a:

```text
oauth_accounts
- id
- user_id
- provider
- provider_account_id
```

## MFA/TOTP

Fluxo mínimo:

1. gerar segredo;
2. gerar QR Code/URI;
3. usuário configura autenticador;
4. validar código de confirmação;
5. ativar MFA;
6. exigir TOTP no login quando habilitado.

## Proteção contra abuso

Aplicar rate limiting principalmente em endpoints de autenticação:

- login;
- verificação MFA;
- recuperação de senha;
- endpoints sensíveis equivalentes.

## Autorização

A autorização precisa existir no backend.

---

# 17. Auditoria

Registrar operações relevantes para permitir rastreabilidade.

Eventos mínimos recomendados:

```text
LOGIN
LOGOUT
USER_CREATED
USER_UPDATED
USER_DELETED
ROLE_CHANGED
CUSTOMER_CREATED
CUSTOMER_UPDATED
CUSTOMER_DELETED
CARRIER_CREATED
CARRIER_UPDATED
CARRIER_DELETED
SIMULATION_CREATED
IMPORT_STARTED
IMPORT_COMPLETED
IMPORT_FAILED
```

Não registrar secrets, tokens ou senhas nos logs/auditoria.

---

# 18. Observabilidade

A aplicação deve facilitar diagnóstico.

Implementar:

- logs estruturados;
- `requestId`/correlation id;
- global exception handling;
- logs de método/rota/status/duração;
- health check;
- status de MySQL;
- status de Redis;
- informações de erro úteis sem vazar dados sensíveis.

Exemplo conceitual de log:

```json
{
  "level": "info",
  "requestId": "abc123",
  "method": "POST",
  "path": "/simulations",
  "statusCode": 201,
  "duration": 143
}
```

Endpoint esperado:

```text
GET /health
```

---

# 19. API — organização sugerida

Rotas conceituais:

```text
/auth
  POST /login
  POST /refresh
  POST /logout
  OAuth callbacks
  MFA endpoints

/users
/customers
/carriers

/simulations
  POST /
  GET /
  GET /:id

/dashboard
  GET /overview
  GET /carriers
  GET /routes

/insights

/imports
  POST /
  GET /:id

/audit

/integrations
```

A API deve ter DTOs, validação e respostas de erro consistentes.

---

# 20. Tratamento de erros

Preferir respostas padronizadas.

Exemplo:

```json
{
  "statusCode": 400,
  "code": "INVALID_CEP",
  "message": "O CEP informado é inválido.",
  "timestamp": "2026-09-14T00:00:00.000Z",
  "requestId": "abc123"
}
```

Erros esperados devem ser tratados explicitamente.

Evitar retornar stack trace, secrets ou detalhes internos para o cliente.

---

# 21. Frontend

## Princípios

O frontend deve ser:

- responsivo;
- acessível;
- consistente;
- rápido;
- previsível;
- orientado a dados;
- com feedback visual claro.

## Estados obrigatórios nas interfaces críticas

- loading;
- skeleton;
- empty state;
- error state;
- success toast/feedback;
- confirmação para ações destrutivas.

## Páginas esperadas

Públicas:

- `/`
- páginas institucionais simples quando fizer sentido.

Restritas:

- `/dashboard`
- `/customers`
- `/carriers`
- `/users`
- `/simulations`
- `/simulations/history`
- `/imports`
- `/insights`
- `/audit`
- `/settings` quando houver necessidade.

---

# 22. Componentização do frontend

Criar componentes reutilizáveis para padrões recorrentes, por exemplo:

- Button;
- Input;
- Select;
- Modal;
- Drawer;
- Table;
- Badge;
- Card;
- Tooltip;
- Toast;
- Skeleton;
- EmptyState;
- ErrorState.

Evitar componentes gigantes contendo lógica de API, regra de negócio, UI e transformação de dados ao mesmo tempo.

---

# 23. Gerenciamento de dados

TanStack Query é recomendado para estado servidor.

Zod é recomendado para validação de payloads/formulários.

React Hook Form é recomendado para formulários complexos.

Regras de negócio críticas permanecem no backend.

---

# 24. Testes

Não buscar cobertura artificial.

Priorizar regras com maior risco.

## Unitários

Testar pelo menos:

- cálculo de frete;
- regras de desconto/adicional;
- geração de insights;
- MFA/TOTP;
- autorização;
- isolamento por tenant.

## Integração

Testar:

- autenticação;
- usuários;
- clientes;
- transportadoras;
- simulações;
- imports.

## E2E

Fluxo mínimo:

```text
login
 -> criar cliente
 -> criar transportadora
 -> criar simulação
 -> consultar histórico
```

Adicionar cenário em que Tenant A tenta acessar recurso do Tenant B e deve receber resposta de acesso negado ou recurso não encontrado conforme a política definida.

---

# 25. Arquitetura backend recomendada

Preferir um **monólito modular**.

Não adotar microservices sem necessidade real.

Estrutura conceitual:

```text
apps/api/src
├── modules
│   ├── auth
│   ├── users
│   ├── tenants
│   ├── customers
│   ├── carriers
│   ├── freight
│   ├── dashboard
│   ├── insights
│   ├── imports
│   ├── audit
│   └── integrations
│
├── common
│   ├── decorators
│   ├── guards
│   ├── interceptors
│   ├── filters
│   ├── pipes
│   └── logger
│
├── database
├── config
├── queue
├── websocket
└── main.ts
```

A arquitetura deve manter separação entre:

- controllers;
- DTOs;
- casos de uso/services;
- infraestrutura;
- persistência;
- regras de domínio quando necessário.

---

# 26. Stack recomendada

Além da stack obrigatória, as escolhas recomendadas são:

## Backend

- Prisma;
- Redis;
- BullMQ;
- Socket.IO;
- Jest;
- Supertest.

## Frontend

- TanStack Query;
- React Hook Form;
- Zod;
- Tailwind;
- shadcn/ui;
- Recharts;
- Framer Motion.

Essas escolhas são recomendações de implementação, não requisitos imutáveis do desafio.

---

# 27. Infraestrutura local

Docker Compose deve conseguir disponibilizar pelo menos:

```text
MySQL
Redis
API
Web
```

O projeto deve possuir `.env.example` e instruções claras de inicialização.

Secrets reais nunca devem ser versionados.

---

# 28. Seed e ambiente de demonstração

O projeto deve iniciar com dados suficientes para demonstrar o produto.

Seed recomendado:

- 1 tenant principal;
- 1 admin;
- 2 managers;
- 5 operators;
- múltiplos clientes;
- múltiplas transportadoras;
- dezenas/centenas de simulações;
- dados distribuídos por rotas e transportadoras para alimentar gráficos e insights.

Também é desejável possuir um segundo tenant para demonstrar isolamento de dados.

---

# 29. Documentação do projeto

O repositório deve possuir documentação suficiente para avaliação.

Estrutura recomendada:

```text
docs/
├── architecture.md
├── database.md
├── multi-tenancy.md
├── authentication.md
├── freight-calculation.md
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

Cada ADR deve registrar:

- contexto;
- problema;
- alternativas consideradas;
- decisão;
- consequências.

---

# 30. Critérios para tomada de decisão

Quando surgir uma dúvida durante a implementação, priorizar nesta ordem:

1. Segurança e isolamento de dados.
2. Correção da regra de negócio.
3. Simplicidade arquitetural.
4. Manutenibilidade.
5. Testabilidade.
6. Experiência do usuário.
7. Observabilidade.
8. Performance.
9. Elegância técnica.

Evitar adicionar tecnologias apenas para demonstrar conhecimento.

Toda complexidade nova deve ter uma razão objetiva.

---

# 31. O que não fazer

Não:

- criar microservices por padrão;
- confiar no `tenantId` enviado pelo frontend;
- implementar autorização apenas no frontend;
- hardcodar números do dashboard;
- gerar insights aleatórios;
- armazenar senha em texto puro;
- vazar token/senha em logs;
- usar WebSocket sem caso de uso real;
- processar planilhas pesadas de forma síncrona na requisição principal;
- esconder erros do usuário;
- criar páginas sem loading/error/empty states;
- introduzir bibliotecas sem necessidade clara;
- sacrificar segurança para acelerar a implementação.

---

# 32. Ordem de implementação recomendada

A ordem abaixo reduz retrabalho:

```text
1. Monorepo e tooling
2. Docker + MySQL + Redis
3. Prisma/schema/migrations/seed
4. Tenant + User
5. Auth email/password
6. JWT + refresh token
7. RBAC
8. OAuth Google/GitHub
9. MFA/TOTP
10. CRUD Customers
11. CRUD Carriers
12. CRUD Users
13. Freight calculation
14. Simulations + quotes
15. History
16. Dashboard
17. Insights
18. File upload
19. BullMQ/worker
20. WebSocket progress
21. External APIs
22. Audit
23. Observability
24. Landing page
25. Tests
26. Deploy
27. Documentation/ADRs
28. Final UX/security review
```

---

# 33. Definition of Done por funcionalidade

Uma funcionalidade não deve ser considerada concluída apenas porque o endpoint/tela funciona.

Para ser considerada pronta, verificar:

```text
[ ] regra de negócio implementada
[ ] validação de entrada
[ ] autorização
[ ] tenant isolation
[ ] tratamento de erros
[ ] estados de frontend
[ ] feedback visual
[ ] testes relevantes
[ ] logs quando necessário
[ ] documentação quando a decisão não for óbvia
```

---

# 34. Qualidade de código

Preferir:

- nomes explícitos;
- funções pequenas;
- responsabilidades bem definidas;
- tipagem forte;
- DTOs claros;
- validação na borda;
- serviços focados;
- composição em vez de abstração prematura;
- código fácil de testar.

Evitar:

- `any` sem justificativa;
- funções gigantes;
- controllers com regra de negócio;
- queries espalhadas indiscriminadamente;
- duplicação de regras de autorização;
- condicionais difíceis de entender;
- abstrações criadas antes de existir necessidade real.

---

# 35. Estratégia de desenvolvimento com agente

O agente deve trabalhar de forma incremental.

Antes de implementar uma funcionalidade grande:

1. verificar arquitetura existente;
2. localizar módulos relacionados;
3. preservar convenções do projeto;
4. implementar a menor unidade coerente;
5. testar;
6. revisar segurança/tenant;
7. atualizar documentação quando a decisão for relevante.

Não reescrever arquivos ou módulos inteiros sem necessidade.

Não modificar comportamento existente apenas para adequar ao gosto pessoal.

---

# 36. Estado de prioridade

## Prioridade máxima

- segurança;
- multi-tenancy;
- autenticação;
- RBAC;
- simulação;
- CRUDs obrigatórios;
- dashboard;
- insights;
- async processing;
- WebSocket;
- integrações externas;
- testes;
- deploy.

## Prioridade alta

- auditoria;
- observabilidade;
- UX;
- landing page;
- documentação.

## Prioridade posterior

Qualquer funcionalidade adicional que não aumente de forma clara o valor do produto ou a qualidade da avaliação.

---

# 37. Produto adicional — não obrigatório

É permitido expandir a solução, desde que a expansão permaneça coerente com inteligência logística.

Exemplos aceitáveis:

- alertas de variação de custo;
- filtros avançados;
- score de transportadoras;
- comparativo por região;
- exportação de relatórios;
- alertas operacionais;
- indicadores climáticos.

Novas funcionalidades não devem comprometer a conclusão dos requisitos obrigatórios.

---

# 38. Objetivo final

O resultado esperado é uma aplicação que pareça um produto SaaS B2B real, com:

- boa experiência visual;
- arquitetura coerente;
- segurança demonstrável;
- isolamento de tenants;
- regras de negócio testadas;
- processamento assíncrono real;
- comunicação em tempo real real;
- dashboard baseado em dados;
- insights explicáveis;
- documentação das decisões;
- deploy funcional.

A qualidade da solução deve demonstrar não apenas capacidade de escrever código, mas capacidade de tomar decisões técnicas e de produto coerentes com o contexto.
