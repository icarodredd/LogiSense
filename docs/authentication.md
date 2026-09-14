# Autenticação — LogiSense

Ver ADR `003-authentication`.

## Fluxos

### Registro (público)

`POST /api/auth/register` `{ tenantName, name, email, password }` → cria
**tenant novo + primeiro usuário ADMIN**, já autenticado (cookies setados).
Slug gerado do nome com sufixo em colisão. Audita `TENANT_CREATED` + `LOGIN`.

### Login (público, rate-limit 10/min)

`POST /api/auth/login` `{ email, password }` → valida bcrypt, exige `ACTIVE`,
exige TOTP se `mfaEnabled` (`MFA_REQUIRED` — verificação chega na Fase 4).
Audita `LOGIN`. E-mail é comparado em minúsculas.

### Refresh (público, via cookie)

`POST /api/auth/refresh` lê o cookie `ls_refresh`, valida o hash no banco,
**revoga o token usado (rotação)** e emite par novo. Reuso de refresh antigo
→ `INVALID_REFRESH`. Audita `TOKEN_REFRESHED`.

### Logout (autenticado)

`POST /api/auth/logout` revoga o refresh atual, limpa cookies. Audita `LOGOUT`.

### Sessão atual

`GET /api/auth/me` → `{ user, tenant }`.

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

Proteções extras: sem auto-remoção, sem auto-suspensão, sem trocar o próprio
perfil, sem excluir o último admin ativo.

## Proteção contra abuso

- Throttle global 120 req/min; login 10/min (resposta `429 TOO_MANY_REQUESTS`).
- Cookies `HttpOnly` mitigam exfiltração via XSS (combinar com CSP no frontend).
- Auditoria nunca persiste secrets/tokens (sanitização no `AuditService`).
