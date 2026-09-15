"use client";

import { motion } from "framer-motion";
import { Pencil, Plus, Search, Trash2, Truck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { DataPageShell } from "../../components/data-page";
import { SortableTable } from "../../components/sortable-table";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { api, type Carrier } from "../../lib/api";

export default function CarriersPage() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", document: "", email: "", phone: "", baseFee: "", pricePerKg: "", pricePerKm: "", riskPercent: "0.01", cubingFactor: "6000" });
  useEffect(() => { const timer = window.setTimeout(() => { api.carriersList(query ? `&search=${encodeURIComponent(query)}` : "").then((r) => setCarriers(r.data)).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar as transportadoras.")).finally(() => setLoading(false)); }, 0); return () => window.clearTimeout(timer); }, [query]);
  function openCreate() { setEditingId(null); setForm({ name: "", document: "", email: "", phone: "", baseFee: "", pricePerKg: "", pricePerKm: "", riskPercent: "0.01", cubingFactor: "6000" }); setDialog(true); }
  function openEdit(carrier: Carrier) { setEditingId(carrier.id); setForm({ name: carrier.name, document: carrier.document ?? "", email: carrier.email ?? "", phone: carrier.phone ?? "", baseFee: String(carrier.baseFee), pricePerKg: String(carrier.pricePerKg), pricePerKm: String(carrier.pricePerKm), riskPercent: String(carrier.riskPercent), cubingFactor: "6000" }); setDialog(true); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const data = { ...form, baseFee: Number(form.baseFee), pricePerKg: Number(form.pricePerKg), pricePerKm: Number(form.pricePerKm), riskPercent: Number(form.riskPercent), cubingFactor: Number(form.cubingFactor) };
    try { if (editingId) await api.updateCarrier(editingId, data); else await api.createCarrier(data); setDialog(false); setEditingId(null); const result = await api.carriersList(query ? `&search=${encodeURIComponent(query)}` : ""); setCarriers(result.data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar a transportadora."); }
    finally { setSaving(false); }
  }
  async function toggleActive(carrier: Carrier) { try { await api.updateCarrier(carrier.id, { active: !carrier.active }); const result = await api.carriersList(query ? `&search=${encodeURIComponent(query)}` : ""); setCarriers(result.data); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o status."); } }
  async function remove(id: string) { if (!window.confirm("Remover esta transportadora?")) return; try { await api.deleteCarrier(id); const result = await api.carriersList(query ? `&search=${encodeURIComponent(query)}` : ""); setCarriers(result.data); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível remover a transportadora."); } }
  return <DataPageShell active="/carriers"><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28 }}>
    <div className="page-heading"><div><span className="eyebrow">Rede logística</span><h1>Transportadoras</h1><p>Compare parceiros e mantenha suas condições de frete atualizadas.</p></div><Button onClick={openCreate}><Plus size={16} /> Nova transportadora</Button></div>
    <div className="data-toolbar"><div className="search-field"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou documento" /></div><span className="toolbar-count">{carriers.length} registros</span></div>
    {error && <div className="callout error-callout">{error}</div>}
    <div className="data-panel"><SortableTable><thead><tr><th>Transportadora</th><th>Contato</th><th>Tarifa base</th><th>Por kg</th><th>Status</th><th /></tr></thead><tbody>{loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={6}><div className="table-skeleton" /></td></tr>) : carriers.map((carrier) => <tr key={carrier.id}><td><div className="table-person"><span className="carrier-avatar"><Truck size={14} /></span><strong>{carrier.name}</strong></div><small>{carrier.document || "Documento não informado"}</small></td><td>{carrier.email || carrier.phone || "—"}</td><td>R$ {carrier.baseFee.toFixed(2).replace(".", ",")}</td><td>R$ {carrier.pricePerKg.toFixed(2).replace(".", ",")}</td><td><button className="status-button" onClick={() => void toggleActive(carrier)} aria-label={`${carrier.active ? "Desativar" : "Ativar"} ${carrier.name}`}><Badge className={carrier.active ? "bg-[#edf5ef] text-[#6c9b82]" : "bg-[#f1f3f4] text-[#8a969f]"}>{carrier.active ? "Ativa" : "Inativa"}</Badge></button></td><td><button className="table-action" onClick={() => openEdit(carrier)} aria-label={`Editar ${carrier.name}`}><Pencil size={15} /></button><button className="table-action" onClick={() => remove(carrier.id)} aria-label={`Remover ${carrier.name}`}><Trash2 size={15} /></button></td></tr>)}{!loading && !carriers.length && <tr><td colSpan={6}><div className="empty-table"><Truck size={24} /><strong>Nenhuma transportadora encontrada</strong><span>Cadastre parceiros para comparar suas opções de frete.</span></div></td></tr>}</tbody></SortableTable></div>
    {dialog && <div className="dialog-backdrop" onMouseDown={() => setDialog(false)}><div className="dialog" onMouseDown={(event) => event.stopPropagation()}><div className="dialog-head"><div><h2>{editingId ? "Editar transportadora" : "Nova transportadora"}</h2><p>Configure os parâmetros usados no cálculo.</p></div><button className="icon-button" onClick={() => setDialog(false)} aria-label="Fechar"><X size={18} /></button></div><form onSubmit={save} className="form-grid"><label className="full">Nome<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Documento<input value={form.document} onChange={(event) => setForm({ ...form, document: event.target.value })} /></label><label>E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Telefone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Taxa base<input required type="number" min="0" step="0.01" value={form.baseFee} onChange={(event) => setForm({ ...form, baseFee: event.target.value })} /></label><label>Preço por kg<input required type="number" min="0.01" step="0.01" value={form.pricePerKg} onChange={(event) => setForm({ ...form, pricePerKg: event.target.value })} /></label><label>Preço por km<input required type="number" min="0" step="0.0001" value={form.pricePerKm} onChange={(event) => setForm({ ...form, pricePerKm: event.target.value })} /></label><label>Risco (0 a 1)<input required type="number" min="0" max="1" step="0.001" value={form.riskPercent} onChange={(event) => setForm({ ...form, riskPercent: event.target.value })} /></label><label>Fator de cubagem<input required type="number" min="1" value={form.cubingFactor} onChange={(event) => setForm({ ...form, cubingFactor: event.target.value })} /></label><div className="dialog-actions"><Button type="button" variant="secondary" onClick={() => setDialog(false)}>Cancelar</Button><Button disabled={saving}>{saving ? "Salvando..." : "Salvar transportadora"}</Button></div></form></div></div>}
  </motion.div></DataPageShell>;
}
