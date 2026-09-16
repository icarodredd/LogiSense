import Link from "next/link";
import { ArrowRight, BarChart3, Check, CircleDashed, FileSpreadsheet, Lightbulb, LockKeyhole, Route, ShieldCheck, Sparkles, Truck, Users, Workflow } from "lucide-react";
import { PlatformEntryLink } from "../components/platform-entry-link";

const benefits = [
  {
    icon: BarChart3,
    title: "Custos sob controle",
    description: "Compare alternativas de frete e acompanhe a evolução da operação em um só lugar.",
  },
  {
    icon: Route,
    title: "Decisões mais claras",
    description: "Transforme cada simulação em uma visão objetiva de custo, prazo e economia.",
  },
  {
    icon: ShieldCheck,
    title: "Dados confiáveis",
    description: "Uma experiência segura para equipes que precisam operar com precisão.",
  },
];

const modules = [
  { icon: Route, title: "Simulações comparativas", description: "Calcule cenários de frete com peso, dimensões, distância e valor da carga." },
  { icon: Truck, title: "Transportadoras", description: "Organize sua rede de parceiros e compare custo e prazo em cada rota." },
  { icon: BarChart3, title: "Dashboard operacional", description: "Acompanhe frete médio, economia potencial e as rotas que mais pesam." },
  { icon: Lightbulb, title: "Insights acionáveis", description: "Encontre padrões e oportunidades de economia sem depender de planilhas." },
  { icon: FileSpreadsheet, title: "Importações", description: "Traga seus dados de clientes, transportadoras e operações para o workspace." },
  { icon: Users, title: "Times e permissões", description: "Dê a cada pessoa o nível de acesso necessário para operar com segurança." },
];

const steps = [
  { number: "01", title: "Centralize os dados", description: "Cadastre clientes e transportadoras ou importe sua base operacional." },
  { number: "02", title: "Compare alternativas", description: "Simule uma rota e visualize as cotações organizadas lado a lado." },
  { number: "03", title: "Aja com contexto", description: "Use o histórico, o dashboard e os insights para decidir melhor." },
];

export default function Home() {
  return (
    <main className="marketing-page">
      <nav className="marketing-nav page-width">
        <Link href="/" className="brand-mark">
          <span className="brand-symbol">L</span>
          <span>LogiSense</span>
        </Link>
        <div className="marketing-links">
          <a href="#produto">Produto</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#beneficios">Benefícios</a>
          <Link href="/login" className="nav-login">Entrar</Link>
          <PlatformEntryLink className="button button-primary button-small">
            Acessar plataforma <ArrowRight size={15} />
          </PlatformEntryLink>
        </div>
      </nav>

      <section className="hero page-width">
        <div className="hero-copy">
          <div className="eyebrow"><CircleDashed size={14} /> Inteligência para sua operação logística</div>
          <h1>Transforme custos logísticos em decisões melhores.</h1>
          <p className="hero-text">
            A LogiSense reúne simulações, custos, histórico e inteligência operacional
            para sua equipe encontrar alternativas melhores com mais segurança.
          </p>
          <div className="hero-actions">
            <PlatformEntryLink className="button button-primary">
              Conhecer a plataforma <ArrowRight size={16} />
            </PlatformEntryLink>
            <a href="#produto" className="button button-secondary">Como funciona</a>
          </div>
          <div className="hero-note"><Check size={15} /> Menos planilhas. Mais clareza em cada decisão de transporte.</div>
        </div>
        <div className="hero-preview" id="produto">
          <div className="preview-topline"><span>Visão geral</span><span className="status-dot">Atualizado agora</span></div>
          <div className="preview-heading">
            <div><span className="muted-label">Operação consolidada</span><strong>Setembro, 2026</strong></div>
            <span className="preview-period">Últimos 30 dias</span>
          </div>
          <div className="preview-metrics">
            <div><span>Simulações</span><strong>248</strong><small className="positive">+12,8%</small></div>
            <div><span>Frete médio</span><strong>R$ 684</strong><small>por operação</small></div>
            <div><span>Economia potencial</span><strong>R$ 18,4k</strong><small className="positive">nas comparações</small></div>
          </div>
          <div className="preview-chart">
            <div className="chart-labels"><span>Evolução do custo médio</span><span>R$ 900</span></div>
            <div className="chart-area">
              <div className="chart-grid"><i /><i /><i /><i /></div>
              <svg viewBox="0 0 500 130" preserveAspectRatio="none" aria-label="Gráfico de evolução de custos">
                <path d="M0 91 C45 74, 55 88, 92 70 S145 83, 174 62 S220 56, 252 70 S300 34, 335 48 S385 31, 420 41 S465 20, 500 28" fill="none" stroke="#6c8da0" strokeWidth="3" />
                <path d="M0 91 C45 74, 55 88, 92 70 S145 83, 174 62 S220 56, 252 70 S300 34, 335 48 S385 31, 420 41 S465 20, 500 28 L500 130 L0 130Z" fill="url(#fill)" opacity=".5" />
                <defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#b9ced9" /><stop offset="1" stopColor="#f9fbfc" /></linearGradient></defs>
              </svg>
            </div>
            <div className="chart-months"><span>01 set</span><span>08 set</span><span>15 set</span><span>22 set</span><span>30 set</span></div>
          </div>
          <div className="preview-insight"><span className="insight-mark">↘</span><span><strong>Oportunidade de economia</strong><small>A alternativa mais econômica aparece em 68% das simulações recentes.</small></span></div>
        </div>
      </section>

      <section className="story-section page-width" id="como-funciona">
        <div className="story-copy">
          <span className="eyebrow">O custo da falta de contexto</span>
          <h2>Quando cada frete é analisado isoladamente, a operação perde eficiência.</h2>
          <p>Informações espalhadas dificultam a comparação, escondem oportunidades e tornam cada decisão mais lenta. A LogiSense conecta os dados para que sua equipe enxergue o cenário antes de escolher.</p>
          <div className="story-points">
            <div><Check size={16} /><span>Compare opções antes de contratar</span></div>
            <div><Check size={16} /><span>Identifique rotas e custos recorrentes</span></div>
            <div><Check size={16} /><span>Crie uma memória operacional para o time</span></div>
          </div>
        </div>
        <div className="story-card">
          <div className="story-card-head"><span>Antes da LogiSense</span><span className="story-risk">visibilidade fragmentada</span></div>
          <div className="story-lines"><i /><i /><i /><i /><i /></div>
          <div className="story-card-foot"><span>Planilhas</span><span>E-mails</span><span>Decisões isoladas</span></div>
        </div>
      </section>

      <section className="benefits page-width" id="beneficios">
        <div className="section-intro"><span className="eyebrow">Uma operação mais consciente</span><h2>Menos incerteza.<br />Mais contexto para agir.</h2></div>
        <div className="benefit-grid">{benefits.map(({ icon: Icon, title, description }) => <article className="benefit-item" key={title}><span className="benefit-icon"><Icon size={19} /></span><h3>{title}</h3><p>{description}</p></article>)}</div>
      </section>

      <section className="modules-section page-width" id="recursos">
        <div className="section-heading"><span className="eyebrow">Tudo conectado</span><h2>Uma base única para a inteligência da sua operação.</h2><p>Do primeiro cadastro à análise de economia, cada recurso foi pensado para reduzir atrito e aumentar a qualidade da decisão.</p></div>
        <div className="module-grid">{modules.map(({ icon: Icon, title, description }) => <article className="module-card" key={title}><span className="module-icon"><Icon size={19} /></span><h3>{title}</h3><p>{description}</p><ArrowRight size={15} className="module-arrow" /></article>)}</div>
      </section>

      <section className="steps-section page-width">
        <div className="section-heading"><span className="eyebrow">Do dado à decisão</span><h2>Comece simples. Evolua com a operação.</h2></div>
        <div className="steps-grid">{steps.map(({ number, title, description }) => <article className="step-item" key={number}><span className="step-number">{number}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
      </section>

      <section className="trust-section page-width">
        <div className="trust-panel">
          <div className="trust-copy"><span className="eyebrow"><LockKeyhole size={14} /> Segurança por padrão</span><h2>Dados organizados para as pessoas certas.</h2><p>Um workspace preparado para equipes que precisam operar com confiança, rastreabilidade e controle.</p></div>
          <div className="trust-list"><div><ShieldCheck size={18} /><span><strong>Multi-tenant</strong><small>Dados isolados por empresa</small></span></div><div><Users size={18} /><span><strong>Perfis de acesso</strong><small>Permissões para cada papel</small></span></div><div><Workflow size={18} /><span><strong>Auditoria</strong><small>Ações importantes rastreáveis</small></span></div></div>
        </div>
      </section>

      <section className="cta-section page-width">
        <div><span className="eyebrow"><Sparkles size={14} /> Mais clareza para sua operação</span><h2>Pronto para tomar decisões de frete com mais contexto?</h2><p>Entre na plataforma e veja como a LogiSense pode organizar sua rotina logística.</p></div>
        <PlatformEntryLink className="button button-primary">Acessar a plataforma <ArrowRight size={16} /></PlatformEntryLink>
      </section>

      <footer className="marketing-footer page-width"><span>© 2026 LogiSense</span><span>Inteligência logística para decisões melhores.</span></footer>
    </main>
  );
}
