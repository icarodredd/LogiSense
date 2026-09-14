# Autenticação — LogiSense

Ver ADR `003-authentication`.

## Fluxos

### Registro (público)

`POST /api/auth/register` `{ tenantName, name, email, password }` → cria
**tenant novo + primeiro usuário ADMIN**, já autenticado (cookies setados).
Slug gerado do nome com sufixo em colisão. Audita `TENANT_CREATED` + `LOGIN`.

### Login (público, rate-limit 10/min)

`POST /api/auth/login` `{ email, password, totpCode? }` → valida bcrypt, exige
`ACTIVE`. Contas com `mfaEnabled` exigem `totpCode` (6 dígitos): sem ele →
`MFA_REQUIRED` (401); inválido → `INVALID_TOTP` (401). Audita `LOGIN`.
E-mail é comparado em minúsculas.

### Refresh (público, via cookie)

`POST /api/auth/refresh` lê o cookie `ls_refresh`, valida o hash no banco,
**revoga o token usado (rotação)** e emite par novo. Reuso de refresh antigo
→ `INVALID_REFRESH`. Audita `TOKEN_REFRESHED`.

### Logout (autenticado)

`POST /api/auth/logout` revoga o refresh atual, limpa cookies. Audita `LOGOUT`.

### Sessão atual

`GET /api/auth/me` → `{ user, tenant }`.

### MFA/TOTP (autenticado)

Fluxo em 3 passos (segredo **cifrado AES-256-GCM** em repouso — chave via
`MFA_ENCRYPTION_KEY`, obrigatória em produção):

1. `POST /api/auth/mfa/setup` → `{ otpauthUri, qrCodeDataUri, secret }`
   (segredo pendente; um novo setup sobrescreve o anterior);
2. `POST /api/auth/mfa/confirm` `{ totpCode }` → valida o 1º código do
   autenticador e ativa o MFA. Rate-limit 5/min. Audita `MFA_ENABLED`;
3. `POST /api/auth/mfa/disable` `{ password, totpCode }` → exige senha
   correta **e** TOTP válido. Rate-limit 5/min. Audita `MFA_DISABLED`.

O `secret` (base32) só aparece na resposta do setup (input manual); o QR Code
embuti a otpauth URI. Verificação TOTP usa janela padrão de tolerância de
clock skew do otplib.

### OAuth Google/GitHub (público)

Fluxo Authorization Code com `state` anti-CSRF (Redis, TTL 5 min, one-time):

```text
GET /api/auth/:provider/authorize[?tenantId=...]
  -> redirect ao provedor
GET /api/auth/:provider/callback?code=...&state=...
  -> valida/consome state, troca code, resolve usuário, cria sessão,
     seta cookies, redirect para {FRONTEND_URL}/dashboard
```

`provider` ∈ `google | github` (Google exige e-mail verificado; GitHub consulta
`/user/emails` quando o e-mail é privado). Resolução de usuário:

1. conta OAuth já vinculada (`oauth_accounts`) → login direto;
2. e-mail existe → **vincula** ao usuário do tenant (`tenantId` opcional
   desambigua e-mails repetidos entre tenants);
3. não existe + `tenantId` válido → cria usuário `OPERATOR` vinculado;
4. não existe sem `tenantId` → `OAUTH_NO_ACCOUNT` (401): exige login por
   senha primeiro para vincular.

Erros: `OAUTH_NOT_CONFIGURED`, `OAUTH_INVALID_STATE`, `OAUTH_PROVIDER_ERROR`,
`OAUTH_EMAIL_UNAVAILABLE`. Audita `OAUTH_LOGIN` / `OAUTH_ACCOUNT_LINKED`
(metadata: provider, nunca tokens).

## Tokens e cookies

| Token | Formato | Vida | Transporte |
|---|---|---|---|
| Access | JWT (`sub`, `tenantId`, `email`, `role`) | 15 min | cookie `ls_access` (path `/`) ou header `Bearer` |
| Refresh | opaco 48 bytes (só o **hash SHA-256** vai ao banco) | 7 dias | cookie `ls_refresh` (path `/api/auth`) |

Cookies: `HttpOnly`, `SameSite=Lax`, `Secure` em produção (`COOKIE_SECURE`).
Durações via `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` (`30s|15m|2h|7d`).

## Senhas

- bcryptjs (10 rounds), nunca em texto puro; `passwordHash` nunca sai na API.
- Política: mín. 8 caracteres, letras + números (mensagem em pt-BR no DTO).
- Login usa `bcrypt.compare` por candidato — timing seguro contra enumeração
  (resposta genérica `INVALID_CREDENTIALS`).

## RBAC

Perfis `ADMIN | MANAGER | OPERATOR` (`@Roles(...)` + `RolesGuard` no backend;
frontend apenas reflete). Matriz atual:

| Recurso | ADMIN | MANAGER | OPERATOR |
|---|---|---|---|
| `POST /users`, `PATCH`, `DELETE` | ✅ | ❌ | ❌ |
| `GET /users` | ✅ | ✅ | ❌ |
| `GET /audit` | ✅ | ✅ | ❌ |
| `GET /tenants/me`, `/auth/me` | ✅ | ✅ | ✅ |
| `MFA setup/confirm/disable` | ✅ (própria conta) | ✅ (própria conta) | ✅ (própria conta) |

Proteções extras: sem auto-remoção, sem auto-suspensão, sem trocar o próprio
perfil, sem excluir o último admin ativo.

## Proteção contra abuso

- Throttle global 120 req/min; login 10/min; MFA confirm/disable 5/min
  (resposta `429 TOO_MANY_REQUESTS`).
- Cookies `HttpOnly` mitigam exfiltração via XSS (combinar com CSP no frontend).
- Auditoria nunca persiste secrets/tokens (sanitização no `AuditService`).
- OAuth: `state` aleatório de 24 bytes armazenado no Redis (one-time, TTL 5 min)
  previne CSRF no callback; e-mails não verificados do provedor são rejeitados.
- Segredos TOTP cifrados em repouso (AES-256-GCM via scrypt da env key) —
  vazamento do banco não expõe segredos utilizáveis.
