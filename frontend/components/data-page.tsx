"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronDown, FileUp, LayoutDashboard, LogOut, PackageSearch, Route, Settings, Sparkles, Truck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type AuthUser } from "../lib/api";

const items = [
  ["/dashboard", "Visão geral", LayoutDashboard], ["/simulations/new", "Nova simulação", Route],
  ["/simulations/history", "Histórico", PackageSearch], ["/customers", "Clientes", Users],
  ["/carriers", "Transportadoras", Truck], ["/imports", "Importações", FileUp], ["/insights", "Insights", Sparkles],
] as const;

export function DataPageShell({ active, children }: { active: string; children: ReactNode }) {
  const cachedSession = api.cachedSession();
  const [user, setUser] = useState<AuthUser | null>(cachedSession?.user ?? null);
  const [tenant, setTenant] = useState<{ name: string } | null>(cachedSession?.tenant ?? null);
  const [sessionError, setSessionError] = useState(false);
  const [open, setOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const router = useRouter();
  useEffect(() => { api.me().then((session) => { setUser(session.user); setTenant(session.tenant); }).catch(() => setSessionError(true)); }, []);
  async function logout() { await api.logout().catch(() => undefined); router.push("/login"); }
  const roleLabel = user?.role === "ADMIN" ? "Administrador" : user?.role === "MANAGER" ? "Gestor" : "Operador";
  return <div className="app-shell">
    <aside className={`app-sidebar ${open ? "is-open" : ""}`}><div className="sidebar-head"><Link href="/" className="brand-mark"><span className="brand-symbol">L</span><span>LogiSense</span></Link></div><div className="sidebar-workspace"><button className="sidebar-tenant" onClick={() => setWorkspaceOpen((current) => !current)} aria-expanded={workspaceOpen}><span className="tenant-avatar">{(tenant?.name ?? user?.name ?? "L").slice(0, 1).toUpperCase()}</span><span><small>Workspace</small><strong>{tenant?.name ?? (sessionError ? "Workspace indisponível" : "Carregando...")}</strong></span><ChevronDown size={14} className={workspaceOpen ? "rotate-180" : ""} /></button>{workspaceOpen && <div className="workspace-menu"><strong>{tenant?.name ?? "Workspace"}</strong><span>{user?.email ?? "Sessão indisponível"}</span><Link href="/settings" onClick={() => setWorkspaceOpen(false)}>Configurações</Link></div>}</div><nav className="sidebar-nav"><span className="nav-section-label">Workspace</span>{items.map(([href, label, Icon]) => <Link key={href} href={href} className={active === href ? "active" : ""}><Icon size={17} /><span>{label}</span></Link>)}<span className="nav-section-label nav-admin-label">Gestão</span><Link href="/users"><Users size={17} /><span>Usuários</span></Link><Link href="/audit"><Users size={17} /><span>Auditoria</span></Link></nav><div className="sidebar-bottom"><Link href="/settings"><Settings size={17} /> Configurações</Link><button onClick={logout}><LogOut size={17} /> Sair</button></div></aside>
    <main className="app-main"><header className="app-topbar"><button className="icon-button mobile-menu" onClick={() => setOpen(true)} aria-label="Abrir menu">☰</button><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{active.includes("/simulations") ? "Simulações" : active === "/customers" ? "Clientes" : "Transportadoras"}</strong></div><div className="topbar-actions"><div className="topbar-user"><span>{user?.name?.slice(0, 1).toUpperCase() ?? "L"}</span><div><strong>{user?.name ?? (sessionError ? "Sessão indisponível" : "Carregando...")}</strong><small>{roleLabel}</small></div></div></div></header><div className="content-wrap">{children}</div></main>
  </div>;
}
