# ADR 002 — Multi-tenancy: shared schema + tenant_id

- Status: aceito
- Data: 2026-09-14

## Contexto

SaaS B2B exige isolamento total entre empresas, com custo operacional baixo
e um único deploy (MySQL obrigatório no desafio).

## Problema

Como isolar dados de N empresas sem N bancos e sem risco de vazamento por
parâmetro manipulado.

## Alternativas

1. Database por tenant — descartado: migrações × N, custo, complexidade.
2. Schema por tenant — descartado: MySQL não favorece, tooling fraco.
3. **Shared schema + `tenant_id`** — escolhido, com regra rígida de escopo.

## Decisão

Toda entidade de negócio tem `tenantId` + índice. O tenant é extraído do
JWT no guard e nunca aceito do cliente. Recurso de outro tenant → 404.
E-mail único por tenant (`@@unique([tenantId, email])`).

## Consequências

- Risco principal: esquecer o filtro. Mitigações: convenção documentada,
  code review com checklist (§33 do AGENTS.md), testes de isolamento
  unitários + e2e, e futuramente um linter/CI que sinalize queries sem
  `tenantId`.
- Migrações e backup simples (um banco só).
