"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, BarChart3, CheckCircle2, Loader2, RefreshCw, Sparkles, Target, TrendingUp, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { DataPageShell } from "../../components/data-page";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { api, type Insight } from "../../lib/api";

const labels: Record<string, string> = { economy: "Economia", carrier: "Transportadora", concentration: "Rotas", trend: "Tendência" };
const icons: Record<string, typeof Sparkles> = { economy: ArrowDownRight, carrier: Target, concentration: BarChart3, trend: TrendingUp };

export default function InsightsPage() {
  const [items, setItems] = useState<Insight[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setError("");
    try { setItems(await api.insights()); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar os insights."); } finally { setLoading(false); }
  }
  useEffect(() => {
    api.me().then(({ user }) => setRole(user.role)).catch(() => setRole(null));
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function regenerate() {
    setRefreshing(true); setError(""); setNotice("");
    try { setItems(await api.regenerateInsights()); setNotice("Insights atualizados com os dados mais recentes."); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível gerar novos insights."); } finally { setRefreshing(false); }
  }
  const canRegenerate = role === "ADMIN" || role === "MANAGER";
  return <DataPageShell active="/insights"><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28 }}>
    <div className="page-heading"><div><span className="eyebrow">Inteligência operacional</span><h1>Insights</h1><p>Regras explicáveis para encontrar economia e padrões na sua operação.</p></div>{canRegenerate && <Button onClick={() => void regenerate()} disabled={refreshing}>{refreshing ? <><Loader2 size={16} className="spin" /> Analisando...</> : <><RefreshCw size={16} /> Atualizar insights</>}</Button>}</div>
    {error && <div className="callout error-callout"><TriangleAlert size={15} /> {error}</div>}
    {notice && <div className="callout success-callout"><CheckCircle2 size={15} /> {notice}</div>}
    {role && !canRegenerate && <div className="callout access-callout">Você pode consultar os insights do tenant. A geração de uma nova análise está disponível para administradores e gestores.</div>}
    {loading ? <div className="insight-grid">{[1, 2, 3].map((item) => <div className="panel insight-card-skeleton" key={item}><div className="table-skeleton" /><div className="table-skeleton" /></div>)}</div> : !items.length ? <div className="panel insights-empty"><Sparkles size={30} /><h2>Ainda não há insights</h2><p>Execute algumas simulações e gere uma análise para descobrir oportunidades na operação.</p>{canRegenerate && <Button onClick={() => void regenerate()} disabled={refreshing}>Gerar primeira análise</Button>}</div> : <div className="insight-grid">{items.map((item) => { const Icon = icons[item.type] ?? Sparkles; return <article className={`panel insight-card severity-${item.severity.toLowerCase()}`} key={item.id}><div className="insight-card-head"><span className="insight-icon"><Icon size={18} /></span><Badge>{labels[item.type] ?? item.type}</Badge><span className="insight-date">{new Date(item.createdAt).toLocaleDateString("pt-BR")}</span></div><h2>{item.title}</h2><p>{item.description}</p><small className={`severity-label severity-${item.severity.toLowerCase()}`}>{item.severity === "HIGH" ? "Prioridade alta" : item.severity === "MEDIUM" ? "Atenção recomendada" : "Acompanhamento"}</small></article>; })}</div>}
  </motion.div></DataPageShell>;
}
