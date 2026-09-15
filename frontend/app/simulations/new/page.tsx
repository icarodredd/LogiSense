"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, MapPin, Package, Truck } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { DataPageShell } from "../../../components/data-page";
import { Button } from "../../../components/ui/button";
import { api, type Simulation } from "../../../lib/api";

const initialForm = { origin: "", destination: "", weightKg: "", lengthCm: "", widthCm: "", heightCm: "", cargoValue: "" };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function NewSimulationPage() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState<Simulation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  function change(key: keyof typeof form, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setResult(null);
    try {
      const data = await api.createSimulation({
        origin: form.origin, destination: form.destination,
        weightKg: Number(form.weightKg), lengthCm: Number(form.lengthCm),
        widthCm: Number(form.widthCm), heightCm: Number(form.heightCm), cargoValue: Number(form.cargoValue),
      });
      setResult(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível calcular a simulação."); }
    finally { setLoading(false); }
  }
  return <DataPageShell active="/simulations/new"><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28 }}>
    <div className="page-heading"><div><span className="eyebrow">Análise de transporte</span><h1>Nova simulação</h1><p>Compare o custo estimado entre as transportadoras ativas.</p></div><Link href="/simulations/history" className="button button-secondary">Ver histórico <ArrowRight size={15} /></Link></div>
    <div className="simulation-layout">
      <form className="simulation-form data-panel" onSubmit={submit}>
        <div className="simulation-section"><div className="simulation-section-title"><span><MapPin size={16} /></span><div><h2>Rota</h2><p>Informe a origem e o destino da carga.</p></div></div><div className="form-grid"><label className="full">Origem<input required value={form.origin} onChange={(e) => change("origin", e.target.value)} placeholder="Ex.: São Paulo" /></label><label className="full">Destino<input required value={form.destination} onChange={(e) => change("destination", e.target.value)} placeholder="Ex.: Rio de Janeiro" /></label></div></div>
        <div className="simulation-section"><div className="simulation-section-title"><span><Package size={16} /></span><div><h2>Características da carga</h2><p>Esses dados determinam o peso e o custo estimados.</p></div></div><div className="form-grid"><label>Peso (kg)<input required type="number" min="0.1" step="0.1" value={form.weightKg} onChange={(e) => change("weightKg", e.target.value)} placeholder="0,0" /></label><label>Valor da carga<input required type="number" min="0" step="0.01" value={form.cargoValue} onChange={(e) => change("cargoValue", e.target.value)} placeholder="R$ 0,00" /></label><label>Comprimento (cm)<input required type="number" min="1" value={form.lengthCm} onChange={(e) => change("lengthCm", e.target.value)} placeholder="0" /></label><label>Largura (cm)<input required type="number" min="1" value={form.widthCm} onChange={(e) => change("widthCm", e.target.value)} placeholder="0" /></label><label>Altura (cm)<input required type="number" min="1" value={form.heightCm} onChange={(e) => change("heightCm", e.target.value)} placeholder="0" /></label></div></div>
        {error && <div className="form-error">{error}</div>}<Button disabled={loading} size="lg" className="simulation-submit">{loading ? "Calculando..." : "Comparar fretes"} <ArrowRight size={16} /></Button>
      </form>
      <div className="simulation-result panel">{result ? <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="result-success"><CheckCircle2 size={17} /><span>Simulação concluída</span></div><div className="result-route"><strong>{result.origin}</strong><ArrowRight size={15} /><strong>{result.destination}</strong><small>{result.distanceKm ? `${result.distanceKm} km estimados` : "Distância catalogada"}</small></div><div className="result-summary"><div><span>Peso considerado</span><strong>{result.chargeableWeightKg?.toLocaleString("pt-BR")} kg</strong></div><div><span>Melhor alternativa</span><strong className="result-green">{result.cheapestQuote ? money.format(result.cheapestQuote.totalCost) : "—"}</strong></div></div><div className="quote-list">{result.quotes.map((quote) => <div className={`quote-row ${quote.isCheapest ? "is-cheapest" : ""}`} key={quote.id}><span className="quote-carrier"><Truck size={15} />{quote.carrierName}</span><span><strong>{money.format(quote.totalCost)}</strong><small>{quote.estimatedDays ? `${quote.estimatedDays} dias` : "Prazo a confirmar"}</small></span></div>)}</div><Link href="/simulations/history" className="text-link result-link">Consultar histórico <ArrowRight size={14} /></Link></motion.div> : <div className="result-placeholder"><span><Truck size={22} /></span><h2>Compare suas opções</h2><p>Preencha os dados da rota e da carga para visualizar as cotações das transportadoras ativas.</p><div className="result-steps"><span>1</span><small>Informe a rota</small><span>2</span><small>Descreva a carga</small><span>3</span><small>Compare os resultados</small></div></div>}</div>
    </div>
  </motion.div></DataPageShell>;
}
