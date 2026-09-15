"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, Bell, ChevronDown, CircleHelp, FileUp, LayoutDashboard, LogOut, Menu, PackageSearch, Route, Settings, Sparkles, Truck, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, type AuthUser, type DashboardCarrier, type DashboardOverview, type DashboardRoute } from "../../lib/api";

const navItems = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/simulations/new", label: "Nova simulação", icon: Route },
  { href: "/simulations/history", label: "Histórico", icon: PackageSearch },
  { href: "/customers", label: "Clientes", icon: Users },
  { href: "/carriers", label: "Transportadoras", icon: Truck },
  { href: "/imports", label: "Importações", icon: FileUp },
  { href: "/insights", label: "Insights", icon: Sparkles },
];

const adminItems = [{ href: "/users", label: "Usuários", icon: Users }, { href: "/audit", label: "Auditoria", icon: CircleHelp }];
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Metric({ label, value, detail, tone = "" }: { label: string; value: string; detail: string; tone?: string }) {
  return <div className="metric-card"><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className={`metric-detail ${tone}`}>{detail}</span></div>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [carriers, setCarriers] = useState<DashboardCarrier[]>([]);
  const [routes, setRoutes] = useState<DashboardRoute[]>([]);
  const [error, setError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    Promise.all([api.me(), api.overview(), api.carriers(), api.routes()])
      .then(([session, overviewData, carriersData, routesData]) => {
        setUser(session.user);
        setOverview(overviewData);
        setCarriers(carriersData);
        setRoutes(routesData);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível carregar a visão geral."));
  }, []);

  const maxCarrier = useMemo(() => Math.max(...carriers.map((carrier) => carrier.avgCost), 1), [carriers]);
  const maxRoute = Math.max(...routes.map((route) => route.count), 1);

  async function logout() {
    await api.logout().catch(() => undefined);
    router.push("/login");
  }

  return <div className="app-shell">
    <aside className={`app-sidebar ${mobileNav ? "is-open" : ""}`}>
      <div className="sidebar-head"><Link href="/" className="brand-mark"><span className="brand-symbol">L</span><span>LogiSense</span></Link><button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Fechar menu"><X size={18} /></button></div>
      <div className="sidebar-tenant"><span className="tenant-avatar">{user?.name?.slice(0, 1).toUpperCase() ?? "L"}</span><span><small>Operação</small><strong>{user?.name ?? "Carregando..."}</strong></span><ChevronDown size={14} /></div>
      <nav className="sidebar-nav"><span className="nav-section-label">Workspace</span>{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={href === "/dashboard" ? "active" : ""} onClick={() => setMobileNav(false)}><Icon size={17} /><span>{label}</span></Link>)}<span className="nav-section-label nav-admin-label">Gestão</span>{adminItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileNav(false)}><Icon size={17} /><span>{label}</span></Link>)}</nav>
      <div className="sidebar-bottom"><Link href="/settings"><Settings size={17} /> Configurações</Link><button onClick={logout}><LogOut size={17} /> Sair</button></div>
    </aside>
    {mobileNav && <button className="sidebar-overlay" onClick={() => setMobileNav(false)} aria-label="Fechar menu" />}
    <main className="app-main">
      <header className="app-topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Menu size={20} /></button><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>Visão geral</strong></div><div className="topbar-actions"><button className="icon-button" aria-label="Notificações"><Bell size={18} /><i /></button><div className="topbar-user"><span>{user?.name?.slice(0, 1).toUpperCase() ?? "L"}</span><div><strong>{user?.name ?? "Usuário"}</strong><small>{user?.role === "ADMIN" ? "Administrador" : "Operação"}</small></div></div></div></header>
      <div className="content-wrap">
        <div className="page-heading"><div><span className="eyebrow">Terça-feira, 15 de setembro</span><h1>Visão geral</h1><p>Acompanhe o que está acontecendo na sua operação.</p></div><Link href="/simulations/new" className="button button-primary"><Route size={16} /> Nova simulação</Link></div>
        {error && <div className="callout error-callout">{error} <Link href="/login">Voltar para o login</Link></div>}
        <section className="metrics-grid"><Metric label="Simulações realizadas" value={overview ? overview.totalSimulations.toLocaleString("pt-BR") : "—"} detail="no período selecionado" /><Metric label="Frete médio" value={overview ? currency.format(overview.avgFreight) : "—"} detail="por operação" /><Metric label="Menor frete encontrado" value={overview ? currency.format(overview.minFreight) : "—"} detail="melhor alternativa" tone="positive" /><Metric label="Economia potencial" value={overview ? currency.format(overview.potentialSavings) : "—"} detail="nas comparações" tone="positive" /></section>
        <section className="dashboard-grid">
          <div className="panel trend-panel"><div className="panel-heading"><div><h2>Evolução do custo médio</h2><p>Menor cotação por semana</p></div><button className="select-button">Últimas 4 semanas <ChevronDown size={14} /></button></div>{overview?.trendWeekly.length ? <div className="trend-chart"><div className="axis-labels"><span>R$ {Math.round(Math.max(...overview.trendWeekly.map((point) => point.avgCost)) / 1000)}k</span><span>R$ 0</span></div><div className="trend-lines"><i /><i /><i /><i /><svg viewBox="0 0 600 180" preserveAspectRatio="none"><polyline points={overview.trendWeekly.map((point, index) => `${(index / Math.max(overview.trendWeekly.length - 1, 1)) * 600},${165 - (point.avgCost / Math.max(...overview.trendWeekly.map((item) => item.avgCost), 1)) * 130}`).join(" ")} fill="none" stroke="#6c8da0" strokeWidth="3" /></svg></div><div className="axis-bottom">{overview.trendWeekly.map((point) => <span key={point.week}>{new Date(`${point.week}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>)}</div></div> : <div className="panel-empty">Ainda não há dados suficientes para exibir a tendência.</div>}</div>
          <div className="panel"><div className="panel-heading"><div><h2>Por transportadora</h2><p>Custo médio comparado</p></div><BarChart3 size={18} className="panel-icon" /></div><div className="carrier-list">{carriers.slice(0, 4).map((carrier) => <div className="carrier-row" key={carrier.carrierId}><div className="carrier-row-top"><span>{carrier.carrierName}</span><strong>{currency.format(carrier.avgCost)}</strong></div><div className="bar-track"><i style={{ width: `${(carrier.avgCost / maxCarrier) * 100}%` }} /></div><small>{carrier.simulationCount} simulações</small></div>)}{!carriers.length && <div className="panel-empty">As transportadoras aparecerão depois das primeiras simulações.</div>}</div></div>
          <div className="panel routes-panel"><div className="panel-heading"><div><h2>Rotas mais frequentes</h2><p>Onde sua operação mais acontece</p></div><Route size={18} className="panel-icon" /></div><div className="route-list">{routes.slice(0, 5).map((route) => <div className="route-row" key={`${route.origin}-${route.destination}`}><div><strong>{route.origin}</strong><span>→</span><strong>{route.destination}</strong></div><div><span className="route-count">{route.count}</span><small>simulações</small><i className="route-bar"><b style={{ width: `${(route.count / maxRoute) * 100}%` }} /></i></div></div>)}{!routes.length && <div className="panel-empty">Suas principais rotas aparecerão aqui.</div>}</div></div>
          <div className="panel insight-panel"><div className="panel-heading"><div><h2>Leitura da operação</h2><p>Um ponto para observar</p></div><Sparkles size={18} className="panel-icon" /></div><div className="insight-content"><span className="insight-large">↘</span><div><span className="eyebrow">Economia potencial</span><h3>{overview?.potentialSavings ? `${currency.format(overview.potentialSavings)} podem ser economizados` : "Compare suas primeiras simulações"}</h3><p>{overview?.potentialSavings ? "A diferença entre as alternativas encontradas mostra onde uma escolha mais consciente pode reduzir seus custos." : "Ao criar uma simulação, você poderá visualizar diferenças de custo e oportunidades da operação."}</p></div></div><Link href="/insights" className="text-link">Ver insights <ArrowRight size={14} /></Link></div>
        </section>
      </div>
    </main>
  </div>;
}
