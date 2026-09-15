"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { DataPageShell } from "../../components/data-page";
import { SortableTable } from "../../components/sortable-table";
import { Button } from "../../components/ui/button";
import { api, type AuthUser, type ManagedUser } from "../../lib/api";

const empty = { name: "", email: "", password: "", role: "OPERATOR" as ManagedUser["role"] };
const roleLabel = { ADMIN: "Administrador", MANAGER: "Gestor", OPERATOR: "Operador" };

export default function UsersPage() {
  const [session, setSession] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const canManage = session?.role === "ADMIN";
  const load = useCallback(async () => { setLoading(true); try { setUsers((await api.users(query ? `&search=${encodeURIComponent(query)}` : "")).data); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar os usuários."); } finally { setLoading(false); } }, [query]);
  useEffect(() => { api.me().then((r) => { setSession(r.user); if (r.user.role !== "OPERATOR") void load(); else setLoading(false); }).catch((e) => setError(e instanceof Error ? e.message : "Sessão inválida.")); }, [load]);
  async function save(e: React.FormEvent) { e.preventDefault(); setSaving(true); setError(""); setSuccess(""); try { if (editing) await api.updateUser(editing.id, { name: form.name, role: form.role }); else await api.createUser(form); setEditing(null); setForm(empty); setSuccess("Usuário salvo com sucesso."); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar o usuário."); } finally { setSaving(false); } }
  async function remove(id: string) { if (!window.confirm("Remover este usuário?")) return; try { await api.deleteUser(id); setSuccess("Usuário removido."); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível remover o usuário."); } }
  return <DataPageShell active="/users"><div className="page-heading"><div><span className="eyebrow">Gestão</span><h1>Usuários</h1><p>Controle acessos e responsabilidades da sua organização.</p></div>{canManage && <Button onClick={() => { setEditing(null); setForm(empty); }}><Plus size={16} /> Novo usuário</Button>}</div>
    {session?.role === "OPERATOR" ? <div className="panel panel-empty"><ShieldCheck size={25} /><strong>Acesso restrito</strong><span>Somente administradores e gestores podem consultar usuários.</span></div> : <><div className="data-toolbar"><div className="search-field"><Users size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou e-mail" /></div><span className="toolbar-count">{users.length} registros</span></div>{error && <div className="callout error-callout">{error}</div>}{success && <div className="callout success-callout">{success}</div>}<div className="data-panel"><SortableTable><thead><tr><th>Usuário</th><th>Perfil</th><th>Status</th><th>MFA</th><th /></tr></thead><tbody>{loading ? <tr><td colSpan={5}><div className="table-skeleton" /></td></tr> : users.map((u) => <tr key={u.id}><td><div className="table-person"><span>{u.name.slice(0, 1)}</span><strong>{u.name}</strong></div><small>{u.email}</small></td><td>{roleLabel[u.role]}</td><td>{u.status === "ACTIVE" ? "Ativo" : "Suspenso"}</td><td>{u.mfaEnabled ? "Ativo" : "—"}</td><td>{canManage && <><button className="table-action" onClick={() => { setEditing(u); setForm({ name: u.name, email: u.email, password: "", role: u.role }); }} aria-label={`Editar ${u.name}`}><Pencil size={15} /></button><button className="table-action" onClick={() => remove(u.id)} aria-label={`Remover ${u.name}`}><Trash2 size={15} /></button></>}</td></tr>)}{!loading && !users.length && <tr><td colSpan={5}><div className="empty-table"><Users size={24} /><strong>Nenhum usuário encontrado</strong><span>Convide alguém para começar.</span></div></td></tr>}</tbody></SortableTable></div>{canManage && <form onSubmit={save} className="panel form-grid" style={{ marginTop: 16 }}><h2 className="full">{editing ? "Editar usuário" : "Novo usuário"}</h2><label>Nome<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>E-mail<input required type="email" disabled={!!editing} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>{!editing && <label>Senha<input required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>}<label>Perfil<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as ManagedUser["role"] })}>{Object.entries(roleLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="dialog-actions"><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar usuário"}</Button>{editing && <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>}</div></form>}</>}</DataPageShell>;
}
