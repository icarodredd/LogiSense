# Processamento Assíncrono — LogiSense

## Visão geral

O LogiSense usa **BullMQ** (Redis) para processamento assíncrono e **Socket.IO** para comunicação em tempo real.

## Fluxo principal: Importação de arquivos

```text
Frontend
  -> POST /api/imports (FileInterceptor)
Backend
  -> ImportsController recebe arquivo
  -> ImportsService.create():
     1. Salva metadados no banco (status=PENDING)
     2. Cria job no BullMQ (ImportProcessor.addImportJob)
     3. Atualiza status para PROCESSING
     4. Registra audit IMPORT_STARTED
     5. Responde ao frontend com import metadata

BullMQ Worker (ImportProcessor)
  -> Consome jobs da fila import-processing
  -> ImportWorker.process(importId, tenantId, filePath, mimeType, type, auditCtx, userId):
     1. Busca import no banco (filtra por tenantId!)
     2. WebSocket: emite progresso 0%
     3. Parseia arquivo (CSV com csv-parse, XLSX com exceljs)
     4. Valida tipo (CUSTOMERS/CARRIERS processados; SIMULATIONS ainda não suportado)
     5. Processa linhas em lotes (100 por batch) com upsert idempotente
     6. WebSocket: emite progresso a cada lote
     7. Atualiza banco: processedRows, status
     8. WebSocket: emite COMPLETED ou FAILED
     9. Registra audit IMPORT_COMPLETED / IMPORT_FAILED
     10. Remove o arquivo do disco após processamento

Frontend
  -> Conecta-se ao WebSocket
  -> Emite 'join-import' com importId
  -> Recebe 'import-progress' e atualiza UI
```

## Queue (BullMQ)

### Configuração

- **Nome da fila**: `import-processing`
- **Retry**: 3 tentativas com backoff exponencial (5s)
- **Remoção**: removido ao completar, mantém 1000 falhas

### ImportProcessor

Responsável por:
- Receber `IMPORT_QUEUE` injetada pelo QueueModule
- Criar o BullMQ Worker que consome jobs
- Adicionar novos jobs via `addImportJob()`

### ImportWorker

Processa cada import:
- Recebe filePath, mimeType, type, auditCtx, userId
- Valida `tenantId` (regra de segurança)
- Parseia arquivo: CSV com `csv-parse`, XLSX com `exceljs`
- Processa registros de fato:
  - **CUSTOMERS**: upsert por `document` (ou `name` quando sem documento), campos `name/document/cep/email/phone/city/state` (aceita headers PT-BR: `nome`, `documento`, `telefone`, `cidade`, `uf`)
  - **CARRIERS**: upsert por `name`, campos de precificação `baseFee/pricePerKg/pricePerKm/riskPercent/cubingFactor` (aceita vírgula decimal e headers PT-BR)
  - **SIMULATIONS**: rejeitado com erro claro (ainda não suportado)
- Linhas inválidas (sem `name`) são puladas e contabilizadas como `skipped` no audit
- Envia progresso via WebSocket
- Atualiza status no banco
- Registra auditoria (IMPORT_COMPLETED/IMPORT_FAILED)
- Remove o arquivo do disco no fim (independente de sucesso/falha)

## WebSocket (Socket.IO)

### Autenticação

- Conexões exigem JWT (header `Authorization: Bearer` ou `auth.token` no handshake); sem token, o socket é desconectado
- `join-import` valida que o import pertence ao tenant do usuário autenticado — sala por importId, posse = isolamento entre tenants

### Eventos

| Direção | Evento | Payload |
|---|---|---|
| Frontend → Backend | `join-import` | `{ importId: string }` |
| Backend → Frontend | `import-progress` | `{ status, processed, total, percentage, errorMessage? }` |

### Progresso

```json
{
  "importId": "uuid",
  "status": "PROCESSING",
  "processed": 720,
  "total": 1500,
  "percentage": 48
}
```

## Upload

- `POST /api/imports` com multipart `file` + `type` (CUSTOMERS | CARRIERS | SIMULATIONS)
- Arquivo salvo em `uploads/imports/` com nome UUID (diskStorage multer)
- Validação: extensão `.csv`/`.xlsx`, mime types conhecidos, limite 10MB
- `mimeType` real do arquivo é persistido no `Import`

## Estados de importação

```text
PENDING → PROCESSING → COMPLETED
                   ↘ FAILED
```

## Princípios

- **Idempotência**: upsert por chave de negócio (document/name) — reimportar atualiza em vez de duplicar; jobs com `jobId: importId` não duplicam processamento.
- **Isolamento por tenant**: Worker valida `tenantId` antes de processar; todas as queries filtram pelo tenant do import.
- **Não bloqueia requisição**: Upload retorna imediatamente; processamento é em background.
- **Feedback visual**: WebSocket permite acompanhar progresso em tempo real.

---

## Estrutura no código

```text
src/
├── queue/
│   ├── queue.module.ts          # BullMQ Queue factory (IMPORT_QUEUE)
│   ├── queue.constants.ts       # Nomes de filas
│   └── import.processor.ts      # Consumer + Worker (injetado com IMPORT_QUEUE)
├── modules/imports/
│   ├── imports.service.ts       # Cria import + enfileira job + audit
│   ├── import.worker.ts         # Parseia CSV/XLSX + processa + audit
│   ├── imports.controller.ts    # Upload endpoint
│   └── imports.module.ts        # Importa QueueModule
└── websocket/
    └── websocket.gateway.ts     # Socket.IO (progress events)
```

### Dependências

- `bullmq`: fila de jobs
- `csv-parse`: parsing de CSV
- `exceljs`: parsing de XLSX
- `socket.io`: comunicação em tempo real
