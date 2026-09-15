# LogiSense Frontend

Frontend da plataforma LogiSense, construído com Next.js, React, TypeScript, Tailwind CSS 4 e shadcn/ui.

O produto é uma plataforma B2B de inteligência logística. A interface deve ajudar equipes a comparar fretes, acompanhar custos e tomar decisões operacionais com clareza.

## Princípios de implementação

- Integrar cada tela ao backend real; não manter mocks como substitutos de dados.
- Respeitar autenticação, perfil e isolamento de tenant definidos pelo backend.
- Nunca aceitar `tenantId` do formulário, query string ou URL como fonte de autorização.
- Tratar loading, sucesso, erro, vazio, processamento e acesso negado em todas as telas críticas.
- Priorizar legibilidade, previsibilidade e densidade de informação adequada.
- Usar componentes shadcn/ui antes de criar componentes equivalentes manualmente.
- Manter animações sutis e funcionais; nada deve parecer um template de SaaS genérico.
- Validar desktop, tablet e mobile antes de considerar uma tela pronta.

## Stack

| Tecnologia | Uso |
| --- | --- |
| Next.js 16 | App Router e renderização |
| React 19 | Componentes e interações |
| TypeScript | Tipagem estrita |
| Tailwind CSS 4 | Estilos e responsividade |
| shadcn/ui + Radix | Primitivas acessíveis de interface |
| TanStack Query | Estado servidor e invalidação |
| Framer Motion | Transições e animações discretas |
| Lucide | Ícones lineares |
| clsx + tailwind-merge | Composição de classes |
| class-variance-authority | Variantes de componentes |

## Execução local

```bash
cd frontend
pnpm install
pnpm dev
```

Aplicação: `http://localhost:3000`

Variável necessária:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Comandos de validação:

```bash
pnpm lint
pnpm build
```

## Estrutura

```text
app/
├── page.tsx                    # Landing pública
├── login/page.tsx              # Login e MFA
├── dashboard/page.tsx          # Visão geral
├── customers/page.tsx          # Clientes
├── carriers/page.tsx           # Transportadoras
└── globals.css                 # Tokens e estilos globais

components/
├── data-page.tsx               # Shell compartilhado das páginas de dados
└── ui/                         # Componentes oficiais shadcn/ui

lib/
├── api.ts                      # Cliente HTTP e tipos de domínio
└── utils.ts                    # cn com clsx e tailwind-merge
```

## shadcn/ui

O projeto usa a configuração oficial gerada pelo CLI em `components.json`:

- preset `radix-nova`;
- base Radix;
- aliases `@/*`;
- CSS variables habilitadas;
- Lucide como biblioteca de ícones.

Componentes adicionados atualmente:

- `Button`
- `Badge`
- `Card`
- `Input`
- `Table`
- `Dialog`
- `DropdownMenu`

Para adicionar um componente:

```bash
cd frontend
pnpm dlx shadcn@latest add <componente>
```

Após adicionar, ajustar somente os tokens e variantes necessários para a identidade LogiSense. Evitar duplicar um componente já disponível no shadcn/ui.

## Direção visual

A LogiSense usa uma linguagem corporativa suave, com baixa saturação e foco operacional.

| Token | Valor | Uso |
| --- | --- | --- |
| Canvas | `#F7F8FA` | Fundo da aplicação |
| Surface | `#FFFFFF` | Cards, tabelas e formulários |
| Texto principal | `#263238` | Títulos e conteúdo principal |
| Texto secundário | `#66727D` | Descrições e dados auxiliares |
| Texto auxiliar | `#7D8991` | Labels e informações de apoio |
| Texto discreto | `#9AA5AD` | Somente informações não essenciais |
| Borda | `#E5E9ED` | Divisores e controles |
| Azul institucional | `#587A91` | Ações primárias e navegação |
| Azul escuro | `#466679` | Hover e ênfase |
| Azul pálido | `#EAF1F5` | Seleção e superfícies de apoio |
| Verde | `#6C9B82` | Economia, sucesso e estado ativo |
| Âmbar | `#BF965B` | Atenção |
| Vermelho | `#B87575` | Erro e ação destrutiva |

`--muted` é um token de superfície do shadcn/ui. Não usar esse token como cor de texto. Para textos, usar a hierarquia de tokens definida em `globals.css`.

Evitar:

- gradientes chamativos;
- glow e sombras fortes;
- excesso de cards e badges;
- textos promocionais exagerados;
- dados estáticos para simular respostas do backend;
- animações que prejudiquem leitura ou operação.

## Responsividade

Todas as páginas devem ser implementadas em três faixas:

### Desktop

- Sidebar fixa.
- Grids com duas ou quatro colunas.
- Tabelas com colunas completas.
- Formulários de domínio em duas colunas quando houver espaço.

### Tablet

- Sidebar recolhível ou drawer.
- Cards em duas colunas quando couberem.
- Filtros podem ocupar uma linha independente.
- Tabelas devem preservar as colunas prioritárias e permitir rolagem controlada.

### Mobile

- Sidebar substituída por drawer com overlay.
- Conteúdo com margens laterais de aproximadamente 16px.
- Cards empilhados ou divididos apenas quando a leitura continuar confortável.
- Formulários em uma coluna.
- Modais com margem, altura máxima e rolagem interna.
- Ação primária acessível sem depender de hover.
- Nenhum conteúdo importante pode ficar escondido somente em hover.

Breakpoints precisam ser testados em pelo menos:

- 360px;
- 390px;
- 768px;
- 1024px;
- desktop amplo.

## Estados obrigatórios

Cada tela de negócio deve implementar:

- loading inicial;
- skeleton ou indicador de carregamento;
- empty state com orientação;
- erro da API com mensagem compreensível;
- sucesso após mutação;
- validação de formulário;
- acesso negado;
- confirmação antes de exclusão;
- processamento quando a operação for assíncrona.

## Integração com o backend

O backend roda em `http://localhost:3001` por padrão e usa cookies de sessão.

O cliente em `lib/api.ts` deve:

- usar `credentials: "include"`;
- centralizar headers;
- preservar mensagens e códigos de erro;
- nunca armazenar access token ou refresh token no browser;
- manter tipos compatíveis com os presenters do backend.

Módulos e endpoints principais:

| Módulo | Endpoints |
| --- | --- |
| Auth | `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/auth/me` |
| Dashboard | `/dashboard/overview`, `/dashboard/carriers`, `/dashboard/routes` |
| Clientes | `/customers`, `/customers/:id` |
| Transportadoras | `/carriers`, `/carriers/:id` |
| Simulações | `/simulations`, `/simulations/:id`, `/simulations/history` |
| Imports | `/imports`, `/imports/:id`, `/imports/:id/retry` |
| Insights | `/insights` |
| Usuários | `/users` |
| Auditoria | `/audit` |

## Perfis

| Área | ADMIN | MANAGER | OPERATOR |
| --- | --- | --- | --- |
| Dashboard | Acesso | Acesso | Acesso |
| Simulações | Criar e consultar | Criar e consultar | Criar e consultar |
| Clientes | Gerenciar | Gerenciar | Consultar |
| Transportadoras | Gerenciar | Gerenciar | Consultar |
| Imports | Criar e consultar | Criar e consultar | Consultar |
| Insights | Acesso | Acesso | Acesso |
| Usuários | Gerenciar | Sem acesso | Sem acesso |
| Auditoria | Acesso | Conforme backend | Sem acesso |
| Configurações | Completa | Parcial | Própria |

Ocultar ações não permitidas melhora a UX, mas nunca substitui a autorização no backend.

## Checklist de implementação

### Fundação

- [x] Identidade LogiSense e metadata.
- [x] Tokens visuais e correção de contraste.
- [x] shadcn/ui oficial e `components.json`.
- [x] Componentes Button, Badge, Card, Input, Table, Dialog e DropdownMenu.
- [x] Utilitário `cn`.
- [x] Dependências de animação e ícones.

### Autenticação e shell

- [x] Login por e-mail e senha com mensagens por código de erro.
- [x] MFA como etapa explícita do login.
- [x] Cliente com cookies, refresh automático e sessão expirada.
- [x] Sidebar e topbar.
- [x] Dashboard integrado.
- [x] Cadastro de tenant e primeiro usuário.
- [x] OAuth Google/GitHub com redirecionamento ao backend.
- [x] Tela de recuperação informando a indisponibilidade do endpoint backend.
- [ ] Configuração completa de MFA dentro de configurações.

### Operação

- [x] Clientes: listagem, busca, criação e exclusão.
- [ ] Clientes: edição, detalhe, paginação e status.
- [x] Transportadoras: listagem e busca.
- [ ] Transportadoras: criação, edição, preços, ativação e exclusão.
- [x] Nova simulação.
- [x] Resultado comparativo de cotações.
- [x] Histórico e detalhe de simulações.

### Processamento e inteligência

- [ ] Upload de CSV/XLSX.
- [ ] Status de importação.
- [ ] Progresso via Socket.IO.
- [ ] Retry de importação.
- [ ] Insights por período e severidade.
- [ ] Links contextuais dos insights.

### Administração

- [ ] Gestão de usuários.
- [ ] Alteração de perfis.
- [ ] Auditoria com filtros.
- [ ] Configurações do tenant.
- [ ] Perfil e senha.
- [ ] MFA completo.

### Qualidade e publicação

- [ ] Revisão desktop.
- [ ] Revisão tablet.
- [ ] Revisão mobile.
- [ ] Revisão de contraste e acessibilidade.
- [ ] Revisão de loading, vazio, erro e sucesso.
- [ ] Testes de sessão expirada e API indisponível.
- [ ] `pnpm lint`.
- [ ] `pnpm build`.
- [ ] Atualização final desta documentação.

## Fluxo obrigatório para codar um módulo

1. Ler esta documentação e identificar o item correspondente no checklist.
2. Ler o controller, DTO, presenter e service do backend.
3. Definir tipos da resposta e erros esperados.
4. Planejar a tela em desktop, tablet e mobile.
5. Reutilizar o shell, componentes shadcn e utilitários existentes.
6. Implementar loading, vazio, erro, sucesso e acesso negado.
7. Integrar ao backend real sem aceitar `tenantId` do cliente.
8. Adicionar animações somente onde melhorarem orientação ou feedback.
9. Executar `pnpm lint` e `pnpm build`.
10. Atualizar o checklist deste arquivo e o todo correspondente.

## Definição de pronto

Um módulo só está concluído quando:

- regra de negócio e contrato do backend estão respeitados;
- autorização e isolamento dependem do backend;
- entrada é validada;
- mutações têm feedback;
- estados de loading, erro e vazio existem;
- layout funciona em desktop, tablet e mobile;
- textos são legíveis;
- componentes reutilizáveis foram usados;
- lint e build passam;
- este checklist foi atualizado.
