"use client";

import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, PackageSearch, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DataPageShell } from "../../../components/data-page";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { api, type Simulation } from "../../../lib/api";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export default function HistoryPage() {
  const [items, setItems] = useState<Simulation[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => { api.history(query ? `&search=${encodeURIComponent(query)}` : "").then((response) => setItems(response.items)).catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível carregar o histórico.")).finally(() => setLoading(false)); }, 0); return () => window.clearTimeout(timer); }, [query]);
  return <DataPageShell active="/simulations/history"><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28 }}>
    <div className="page-heading"><div><span className="eyebrow">Análises salvas</span><h1>Histórico de simulações</h1><p>Consulte comparações realizadas pela sua equipe.</p></div><Link href="/simulations/new"><Button><ArrowRight size={16} /> Nova simulação</Button></Link></div>
    <div className="data-toolbar"><div className="search-field"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por origem ou destino" /></div><span className="toolbar-count">{items.length} simulações</span></div>
    {error && <div className="callout error-callout">{error}</div>}
    <div className="data-panel"><table className="data-table"><thead><tr><th>Rota</th><th>Data</th><th>Distância</th><th>Melhor alternativa</th><th>Status</th><th /></tr></thead><tbody>{loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={6}><div className="table-skeleton" /></td></tr>) : items.map((item) => <tr key={item.id}><td><div className="route-table"><strong>{item.origin}</strong><span>→</span><strong>{item.destination}</strong></div><small>{item.weightKg} kg · {item.quotes?.length ?? 0} cotações</small></td><td><span className="date-cell"><CalendarDays size={13} />{new Date(item.createdAt).toLocaleDateString("pt-BR")}</span></td><td>{item.distanceKm ? `${item.distanceKm} km` : "—"}</td><td>{item.cheapestQuote ? <strong className="table-price">{money.format(item.cheapestQuote.totalCost)}</strong> : "—"}</td><td><Badge className="bg-[#edf5ef] text-[#6c9b82]">Concluída</Badge></td><td><Link href={`/simulations/${item.id}`} className="table-action"><ArrowRight size={15} /></Link></td></tr>)}{!loading && !items.length && <tr><td colSpan={6}><div className="empty-table"><PackageSearch size={24} /><strong>Nenhuma simulação encontrada</strong><span>Crie uma simulação para começar a comparar fretes.</span></div></td></tr>}</tbody></table></div>
  </motion.div></DataPageShell>;
}
