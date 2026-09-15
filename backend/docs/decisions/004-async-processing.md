# ADR 004 — Processamento Assíncrono com BullMQ

## Contexto

O desafio exige pelo menos uma funcionalidade com processamento assíncrono e um fluxo de comunicação em tempo real. A importação de arquivos (CSV/XLSX) é a funcionalidade que naturalmente se beneficia de processamento assíncrono, pois a leitura e processamento de arquivos grandes pode levar tempo significativo.

## Decisão

Utilizar **BullMQ** com **Redis** como fila de jobs e **Socket.IO** para comunicação em tempo real do progresso.

## Alternativas consideradas

| Alternativa | Prós | Contras | Decisão |
|---|---|---|---|
| **BullMQ + Redis** | Fila robusta, retries, backoff, amplamente usada | Requer Redis | ✅ Escolhida |
| **Fila nativa do Node.js** | Sem dependências extras | Sem persistência, sem retries | ❌ |
| **Agenda.js** | Simples, baseado em Mongo | Requer MongoDB, menos features | ❌ |
| **Server-Sent Events** | Sem WebSocket | Unidirecional, sem feedback em tempo real | ❌ |
| **WebSocket isolado** | Tempo real | Sem fila para processamento | ❌ |

## Consequências

- **Positivas**: Fila persistente com retries, progresso em tempo real, isolamento de tenant, processamento idempotente.
- **Negativas**: Dependência do Redis, complexidade adicional de monitoramento da fila.
- **Arquitetura**: `QueueModule` fornece `IMPORT_QUEUE` via factory; `ImportProcessor` recebe a injeção e cria o Worker; `ImportWorker` faz o processamento real com parse de CSV/XLSX.

## Notas de implementação

- `QueueModule.forRoot()` cria o Queue via factory e exporta para uso pelo `ImportProcessor`.
- `ImportProcessor` recebe `IMPORT_QUEUE` via `@Inject('IMPORT_QUEUE')`, evitando criação duplicada da Queue.
- Jobs são adicionados com `jobId: importId` para garantir idempotência.
- O `ImportWorker` processa o arquivo, atualiza progresso via WebSocket e registra auditoria.
