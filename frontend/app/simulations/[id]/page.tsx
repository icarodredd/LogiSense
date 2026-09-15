"use client";

import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, MapPin, Package, Truck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DataPageShell } from "../../../components/data-page";
import { Badge } from "../../../components/ui/badge";
import { api, type Simulation } from "../../../lib/api";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export default function SimulationDetailPage() {
  const params = useParams<{ id: string }>();
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api.simulation(params.id).then(setSimulation).catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível carregar a simulação.")); }, [params.id]);
  return <DataPageShell active="/simulations/history"><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28 }}>
    <Link href="/simulations/history" className="back-link"><ArrowLeft size={14} /> Voltar ao histórico</Link><div className="page-heading detail-heading"><div><span className="eyebrow">Detalhe da análise</span><h1>{simulation ? `${simulation.origin} → ${simulation.destination}` : "Simulação"}</h1><p>{simulation ? new Date(simulation.createdAt).toLocaleString("pt-BR") : "Carregando dados..."}</p></div>{simulation && <Badge className="bg-[#edf5ef] text-[#6c9b82]"><CheckCircle2 size={13} /> Concluída</Badge>}</div>
    {error ? <div className="callout error-callout">{error}</div> : simulation && <div className="detail-grid"><div className="panel"><div className="panel-heading"><div><h2>Resumo da carga</h2><p>Informações usadas no cálculo.</p></div><Package size={18} className="panel-icon" /></div><div className="detail-facts"><div><span>Origem</span><strong>{simulation.origin}</strong></div><div><span>Destino</span><strong>{simulation.destination}</strong></div><div><span>Peso real</span><strong>{simulation.weightKg} kg</strong></div><div><span>Peso considerado</span><strong>{simulation.chargeableWeightKg ?? "—"} kg</strong></div><div><span>Dimensões</span><strong>{simulation.lengthCm} × {simulation.widthCm} × {simulation.heightCm} cm</strong></div><div><span>Valor da carga</span><strong>{money.format(simulation.cargoValue)}</strong></div></div></div><div className="panel"><div className="panel-heading"><div><h2>Cotações comparadas</h2><p>{simulation.quotes.length} transportadoras ativas</p></div><Truck size={18} className="panel-icon" /></div><div className="quote-list detail-quotes">{simulation.quotes.map((quote) => <div className={`quote-row ${quote.isCheapest ? "is-cheapest" : ""}`} key={quote.id}><span className="quote-carrier"><Truck size={15} />{quote.carrierName}{quote.isCheapest && <Badge className="bg-[#edf5ef] text-[#6c9b82]">Melhor opção</Badge>}</span><span><strong>{money.format(quote.totalCost)}</strong><small>{quote.estimatedDays ? `${quote.estimatedDays} dias estimados` : "Prazo a confirmar"}</small></span></div>)}</div></div><div className="panel route-detail"><MapPin size={18} /><div><span>Distância estimada</span><strong>{simulation.distanceKm ? `${simulation.distanceKm} km` : "Não informada"}</strong></div><ArrowRight size={16} /><div><span>Economia potencial</span><strong className="result-green">{simulation.potentialSavings ? money.format(simulation.potentialSavings) : "—"}</strong></div></div></div>}
  </motion.div></DataPageShell>;
}
