import Link from "next/link";
import { ArrowRight, BarChart3, Check, CircleDashed, Route, ShieldCheck } from "lucide-react";

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
          <a href="#beneficios">Benefícios</a>
          <Link href="/login" className="nav-login">Entrar</Link>
          <Link href="/dashboard" className="button button-primary button-small">
            Acessar plataforma <ArrowRight size={15} />
          </Link>
        </div>
      </nav>

      <section className="hero page-width">
        <div className="hero-copy">
          <div className="eyebrow"><CircleDashed size={14} /> Inteligência para sua operação logística</div>
          <h1>Clareza para decisões de frete.</h1>
          <p className="hero-text">
            A LogiSense reúne simulações, custos e indicadores para que sua equipe
            encontre alternativas melhores com mais segurança.
          </p>
          <div className="hero-actions">
            <Link href="/dashboard" className="button button-primary">
              Conhecer a plataforma <ArrowRight size={16} />
            </Link>
            <a href="#produto" className="button button-secondary">Como funciona</a>
          </div>
          <div className="hero-note"><Check size={15} /> Uma visão prática para cada decisão de transporte</div>
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

      <section className="benefits page-width" id="beneficios">
        <div className="section-intro"><span className="eyebrow">Uma operação mais consciente</span><h2>Menos incerteza.<br />Mais contexto para agir.</h2></div>
        <div className="benefit-grid">{benefits.map(({ icon: Icon, title, description }) => <article className="benefit-item" key={title}><span className="benefit-icon"><Icon size={19} /></span><h3>{title}</h3><p>{description}</p></article>)}</div>
      </section>

      <footer className="marketing-footer page-width"><span>© 2026 LogiSense</span><span>Inteligência logística para decisões melhores.</span></footer>
    </main>
  );
}
