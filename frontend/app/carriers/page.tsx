"use client";

import { motion } from "framer-motion";
import { Plus, Search, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { DataPageShell } from "../../components/data-page";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { api, type Carrier } from "../../lib/api";

export default function CarriersPage() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => { api.carriersList(query ? `&search=${encodeURIComponent(query)}` : "").then((r) => setCarriers(r.data)).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar as transportadoras.")).finally(() => setLoading(false)); }, 0); return () => window.clearTimeout(timer); }, [query]);
  return <DataPageShell active="/carriers"><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28 }}>
    <div className="page-heading"><div><span className="eyebrow">Rede logística</span><h1>Transportadoras</h1><p>Compare parceiros e mantenha suas condições de frete atualizadas.</p></div><Button><Plus size={16} /> Nova transportadora</Button></div>
    <div className="data-toolbar"><div className="search-field"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou documento" /></div><span className="toolbar-count">{carriers.length} registros</span></div>
    {error && <div className="callout error-callout">{error}</div>}
    <div className="data-panel"><table className="data-table"><thead><tr><th>Transportadora</th><th>Contato</th><th>Tarifa base</th><th>Por kg</th><th>Status</th></tr></thead><tbody>{loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={5}><div className="table-skeleton" /></td></tr>) : carriers.map((carrier) => <tr key={carrier.id}><td><div className="table-person"><span className="carrier-avatar"><Truck size={14} /></span><strong>{carrier.name}</strong></div><small>{carrier.document || "Documento não informado"}</small></td><td>{carrier.email || carrier.phone || "—"}</td><td>R$ {carrier.baseFee.toFixed(2).replace(".", ",")}</td><td>R$ {carrier.pricePerKg.toFixed(2).replace(".", ",")}</td><td><Badge className={carrier.active ? "bg-[#edf5ef] text-[#6c9b82]" : "bg-[#f1f3f4] text-[#8a969f]"}>{carrier.active ? "Ativa" : "Inativa"}</Badge></td></tr>)}{!loading && !carriers.length && <tr><td colSpan={5}><div className="empty-table"><Truck size={24} /><strong>Nenhuma transportadora encontrada</strong><span>Cadastre parceiros para comparar suas opções de frete.</span></div></td></tr>}</tbody></table></div>
  </motion.div></DataPageShell>;
}
