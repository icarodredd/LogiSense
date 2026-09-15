"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Bell, ChevronDown, FileUp, LayoutDashboard, LogOut, PackageSearch, Route, Settings, Sparkles, Truck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type AuthUser } from "../lib/api";

const items = [
  ["/dashboard", "Visão geral", LayoutDashboard], ["/simulations/new", "Nova simulação", Route],
  ["/simulations/history", "Histórico", PackageSearch], ["/customers", "Clientes", Users],
  ["/carriers", "Transportadoras", Truck], ["/imports", "Importações", FileUp], ["/insights", "Insights", Sparkles],
] as const;

export function DataPageShell({ active, children }: { active: string; children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  useEffect(() => { api.me().then((session) => setUser(session.user)).catch(() => undefined); }, []);
  async function logout() { await api.logout().catch(() => undefined); router.push("/login"); }
  return <div className="app-shell">
    <aside className={`app-sidebar ${open ? "is-open" : ""}`}><div className="sidebar-head"><Link href="/" className="brand-mark"><span className="brand-symbol">L</span><span>LogiSense</span></Link></div><div className="sidebar-tenant"><span className="tenant-avatar">{user?.name?.slice(0, 1) ?? "L"}</span><span><small>Operação</small><strong>{user?.name ?? "Carregando..."}</strong></span><ChevronDown size={14} /></div><nav className="sidebar-nav"><span className="nav-section-label">Workspace</span>{items.map(([href, label, Icon]) => <Link key={href} href={href} className={active === href ? "active" : ""}><Icon size={17} /><span>{label}</span></Link>)}<span className="nav-section-label nav-admin-label">Gestão</span><Link href="/users"><Users size={17} /><span>Usuários</span></Link><Link href="/audit"><Users size={17} /><span>Auditoria</span></Link></nav><div className="sidebar-bottom"><Link href="/settings"><Settings size={17} /> Configurações</Link><button onClick={logout}><LogOut size={17} /> Sair</button></div></aside>
    <main className="app-main"><header className="app-topbar"><button className="icon-button mobile-menu" onClick={() => setOpen(true)} aria-label="Abrir menu">☰</button><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{active.includes("/simulations") ? "Simulações" : active === "/customers" ? "Clientes" : "Transportadoras"}</strong></div><div className="topbar-actions"><button className="icon-button" aria-label="Notificações"><Bell size={18} /></button><div className="topbar-user"><span>{user?.name?.slice(0, 1) ?? "L"}</span><div><strong>{user?.name ?? "Usuário"}</strong><small>{user?.role ?? "OPERATOR"}</small></div></div></div></header><div className="content-wrap">{children}</div></main>
  </div>;
}
