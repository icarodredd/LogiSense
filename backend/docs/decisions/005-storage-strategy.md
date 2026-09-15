# ADR 005 — Estratégia de Storage para Upload de Arquivos

## Contexto

A importação de arquivos CSV/XLSX exige que o arquivo seja salvo temporariamente no servidor para que o worker assíncrono possa processá-lo. O desafio exige upload de arquivos relacionados à operação logística.

## Decisão

Armazenar arquivos no filesystem local com caminho registrado no banco de dados (`storedPath`). Em produção, substituir por storage S3/object storage.

## Alternativas consideradas

| Alternativa | Prós | Contras | Decisão |
|---|---|---|---|
| **Filesystem local** | Simples, sem dependências extra | Não escala horizontal, arquivos não persistem em deploy | ✅ Fase local |
| **S3/MinIO** | Escalável, persiste entre deploys | Requer configuração extra, mais complexidade | Planejado para produção |
| **Buffer na memória** | Zero I/O | Memory limit, não funciona para arquivos grandes | ❌ |
| **Upload direto para storage** | Backend não lida com arquivo | Mais complexo no frontend, CORS | ❌ |

## Consequências

- **Positivas**: Implementação simples, funcional para demonstração. O `storedPath` no banco permite rastrear o arquivo.
- **Negativas**: Arquivos não persistem entre reinicializações do container. Não adequado para múltiplos workers.
- **Estrutura**: `Import` model tem `storedPath: String?` e `filename: String`. O `FileInterceptor` do NestJS salva no `uploads/` temporário.

## Migração planejada

Para produção, o `storedPath` deve ser substituído por URLs de objetos (S3/MinIO), e o `FileInterceptor` deve fazer upload direto para o object storage, retornando a URL para o backend.
