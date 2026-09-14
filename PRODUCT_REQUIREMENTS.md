# LogiSense — Requisitos do Produto

Este documento resume os requisitos diretamente derivados do desafio técnico e serve como checklist funcional.

## Requisitos obrigatórios

### Plataforma

- SaaS multi-tenant para gestão logística e análise de fretes.
- Landing page pública.
- Área administrativa/restrita.
- Responsividade.
- Identidade visual própria.
- Animações e storytelling visual.

### Usuários e acesso

- Cadastro de usuários.
- Edição de usuários.
- Remoção de usuários.
- Controle de permissões.
- Perfis com diferentes níveis de acesso.

### Clientes

- Cadastro.
- Consulta.
- Atualização.
- Remoção.

### Transportadoras

- Cadastro.
- Consulta.
- Atualização.
- Remoção.

### Simulação

Permitir simulações contendo:

- origem;
- destino;
- peso;
- dimensões;
- valor da carga.

A lógica de cálculo é definida pela implementação, mas deve ser coerente e documentada.

### Histórico

- Persistir simulações realizadas.
- Permitir consulta do histórico.

### Dashboard

- Indicadores relevantes para tomada de decisão.
- Indicadores calculados a partir dos dados do sistema.

### Insights

- Gerados automaticamente a partir dos dados existentes.
- IA generativa não é obrigatória.

### Integrações

- Pelo menos duas APIs externas.

### Upload

- Importação de arquivos relacionados à operação logística.
- CSV e/ou XLSX.

### Processamento assíncrono

- Pelo menos uma funcionalidade deve ser executada assincronamente.
- Preferência: importação de planilhas.

### Tempo real

- Pelo menos um fluxo de atualização em tempo real entre backend e frontend.
- Preferência: progresso da importação.

### Segurança

Obrigatório:

- email + senha;
- Google OAuth;
- GitHub OAuth;
- MFA/TOTP;
- JWT;
- refresh token;
- RBAC;
- proteção contra abuso de autenticação.

### Auditoria

Registrar ações relevantes, como:

- login;
- logout;
- criação de usuário;
- alteração de permissões;
- operações administrativas.

### Qualidade

- arquitetura organizada;
- separação de responsabilidades;
- DTOs;
- validação;
- tratamento de erros;
- testes automatizados;
- observabilidade;
- logs estruturados;
- rastreamento de requisições;
- deploy público;
- documentação.

---

# Critérios de avaliação a considerar em toda decisão

- Arquitetura
- Segurança
- Qualidade de código
- Testes
- UX
- Interface visual
- Multi-tenancy
- Organização do projeto
- Documentação
- Observabilidade
- Tomada de decisão
- Capacidade de investigação
- Capacidade de resolver problemas de forma autônoma

---

# Regra de prioridade

Não adicionar funcionalidades secundárias antes de garantir todos os requisitos obrigatórios e sua qualidade.
