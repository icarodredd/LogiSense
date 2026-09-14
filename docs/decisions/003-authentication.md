# ADR 003 — Autenticação: JWT curto + refresh opaco rotativo em cookies

- Status: aceito
- Data: 2026-09-14

## Contexto

SaaS B2B com frontend Next.js SSR, exigindo email/senha, OAuth (Fase 4),
MFA (Fase 4), JWT + refresh, RBAC e rate limiting.

## Problema

Equilibrar segurança (XSS, roubo de token) com simplicidade para SSR,
além de permitir revogação imediata de sessão.

## Alternativas

1. Access + refresh ambos JWT em `localStorage` — descartado: XSS exfiltra,
   revogação exige blocklist.
2. Sessão server-side pura — descartado: estado no Redis para cada request,
   menos alinhado ao requisito de JWT.
3. **JWT curto (15 min) + refresh opaco rotativo, ambos em cookies HttpOnly** —
   escolhido.

## Decisão

- Access JWT carrega `sub/tenantId/email/role`; guard revalida usuário no
  banco (cobre suspensão em até ~15 min sem blocklist).
- Refresh é opaco: só o hash SHA-256 persiste; cada uso revoga e emite par
  novo (detecta reuso como `INVALID_REFRESH`).
- Cookies `HttpOnly + SameSite=Lax + Secure` em produção.
- Login aceita e-mail repetido entre tenants: testa a senha nos candidatos
  e autentica no tenant correto.
- Throttle: 120/min global, 10/min no login.

## Consequências

- CSRF: mitigado por `SameSite=Lax` + ações críticas via POST; reavaliar
  token anti-CSRF se surgirem mutações via GET ou embeds cross-site.
- Revogação de access antes de 15 min exige logout do refresh (access morre
  sozinho); aceitável para o perfil da aplicação.
- OAuth/MFA plugam no mesmo emissor de sessão (`TokenService.createSession`).
