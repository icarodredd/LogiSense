# ADR 001 — Monólito modular NestJS

- Status: aceito
- Data: 2026-09-14

## Contexto

A LogiSense precisa entregar muitos módulos (auth, CRUDs, simulações,
dashboard, async, realtime) com um time pequeno e avaliação por qualidade
arquitetural, não por quantidade de serviços.

## Problema

Microservices trariam custo de rede, deploy e consistência sem necessidade
real nesta escala, além de complicar multi-tenancy e auditoria centralizada.

## Alternativas

1. Microservices por domínio — descartado: sem escala que justifique.
2. Monólito em camadas sem módulos — descartado: vira big ball of mud.
3. **Monólito modular NestJS** — escolhido.

## Decisão

`apps`-lógico em `src/modules/*`, cada módulo com controller + service +
DTOs; `src/common` para cross-cutting (filtros, guards, interceptores,
decorators); `src/database` global (Prisma + Redis).

## Consequências

- Deploy único; transações locais quando necessário.
- Fronteiras por módulo facilitam extração futura, se um dia precisar.
- Disciplina necessária: não importar service de outro módulo sem passar
  pelo módulo (usar `exports` explícitos).
