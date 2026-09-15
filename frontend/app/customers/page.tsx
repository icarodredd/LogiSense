"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DataPageShell } from "../../components/data-page";
import { SortableTable } from "../../components/sortable-table";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { api, type Customer } from "../../lib/api";

const empty = { name: "", document: "", email: "", phone: "", cep: "", city: "", state: "" };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(empty);
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await api.customers(query ? `&search=${encodeURIComponent(query)}` : ""); setCustomers(result.data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar os clientes."); }
    finally { setLoading(false); }
  }, [query]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  function openCreate() { setEditingId(null); setForm(empty); setError(""); setDialog(true); }
  function openEdit(customer: Customer) {
    setEditingId(customer.id);
    setForm({ name: customer.name, document: customer.document ?? "", email: customer.email ?? "", phone: customer.phone ?? "", cep: "", city: customer.city ?? "", state: customer.state ?? "" });
    setError("");
    setDialog(true);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      if (editingId) await api.updateCustomer(editingId, form);
      else await api.createCustomer(form);
      setForm(empty); setEditingId(null); setDialog(false); await load();
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível criar o cliente."); }
    finally { setSaving(false); }
  }
  async function remove(id: string) { if (!window.confirm("Remover este cliente?")) return; try { await api.deleteCustomer(id); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível remover o cliente."); } }
  return <DataPageShell active="/customers"><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28 }}>
    <div className="page-heading"><div><span className="eyebrow">Relacionamentos</span><h1>Clientes</h1><p>Organize os clientes associados às suas operações.</p></div><Button onClick={openCreate}><Plus size={16} /> Novo cliente</Button></div>
    <div className="data-toolbar"><div className="search-field"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, documento ou e-mail" /></div><span className="toolbar-count">{customers.length} registros</span></div>
    {error && <div className="callout error-callout">{error}</div>}
    <div className="data-panel"><SortableTable><thead><tr><th>Cliente</th><th>Contato</th><th>Localização</th><th>Status</th><th /></tr></thead><tbody>{loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={5}><div className="table-skeleton" /></td></tr>) : customers.map((customer) => <tr key={customer.id}><td><div className="table-person"><span>{customer.name.slice(0, 1).toUpperCase()}</span><strong>{customer.name}</strong></div><small>{customer.document || "Documento não informado"}</small></td><td>{customer.email || customer.phone || "—"}</td><td>{customer.city ? `${customer.city}${customer.state ? `, ${customer.state}` : ""}` : "—"}</td><td><Badge className={customer.status === "ACTIVE" ? "bg-[#edf5ef] text-[#6c9b82]" : "bg-[#f1f3f4] text-[#8a969f]"}>{customer.status === "ACTIVE" ? "Ativo" : "Inativo"}</Badge></td><td><button className="table-action" onClick={() => openEdit(customer)} aria-label={`Editar ${customer.name}`}><Pencil size={15} /></button><button className="table-action" onClick={() => remove(customer.id)} aria-label={`Remover ${customer.name}`}><Trash2 size={15} /></button></td></tr>)}{!loading && !customers.length && <tr><td colSpan={5}><div className="empty-table"><Users size={24} /><strong>Nenhum cliente encontrado</strong><span>Adicione seu primeiro cliente para começar.</span></div></td></tr>}</tbody></SortableTable></div>
    <AnimatePresence>{dialog && <div className="dialog-backdrop" onMouseDown={() => setDialog(false)}><motion.div initial={{ opacity: 0, scale: .97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .97 }} className="dialog" onMouseDown={(e) => e.stopPropagation()}><div className="dialog-head"><div><h2>{editingId ? "Editar cliente" : "Novo cliente"}</h2><p>Preencha os dados básicos para cadastrar.</p></div><button className="icon-button" onClick={() => setDialog(false)}><X size={18} /></button></div><form onSubmit={save} className="form-grid"><label className="full">Nome<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome da empresa ou pessoa" /></label><label>E-mail<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contato@empresa.com" /></label><label>Documento<input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} placeholder="CPF ou CNPJ" /></label><label>Telefone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" /></label><label>CEP<input pattern="[0-9]{8}" value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder="00000000" /></label><label>Cidade<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="São Paulo" /></label><label>Estado<input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} placeholder="SP" maxLength={2} /></label><div className="dialog-actions"><Button type="button" variant="secondary" onClick={() => setDialog(false)}>Cancelar</Button><Button disabled={saving}>{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar cliente"}</Button></div></form></motion.div></div>}</AnimatePresence>
  </motion.div></DataPageShell>;
}
