"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2 } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { authErrorMessage } from "../../lib/auth-errors";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ tenantName: "", name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordValid = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(form.password);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!passwordValid) { setError("A senha precisa ter pelo menos 8 caracteres, com letras e números."); return; }
    if (form.password !== form.confirmPassword) { setError("As senhas não coincidem."); return; }
    setLoading(true);
    try { await api.register({ tenantName: form.tenantName, name: form.name, email: form.email, password: form.password }); router.push("/dashboard"); }
    catch (cause) { setError(authErrorMessage(cause)); }
    finally { setLoading(false); }
  }
  function change(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  return <main className="auth-page"><div className="auth-panel">
    <Link href="/" className="auth-back"><ArrowLeft size={15} /> Voltar para o início</Link><div className="auth-brand"><span className="brand-symbol">L</span><span>LogiSense</span></div>
    <div className="auth-heading"><span className="eyebrow"><Building2 size={14} /> Comece sua operação</span><h1>Crie seu espaço.</h1><p>Cadastre sua empresa e comece a comparar fretes.</p></div>
    <form onSubmit={submit} className="auth-form"><label>Nome da empresa<input autoComplete="organization" value={form.tenantName} onChange={(e) => change("tenantName", e.target.value)} placeholder="Sua empresa" required /></label><label>Seu nome<input autoComplete="name" value={form.name} onChange={(e) => change("name", e.target.value)} placeholder="Nome completo" required /></label><label>E-mail corporativo<input autoComplete="email" type="email" value={form.email} onChange={(e) => change("email", e.target.value)} placeholder="voce@empresa.com" required /></label><label>Senha<input autoComplete="new-password" type="password" value={form.password} onChange={(e) => change("password", e.target.value)} placeholder="Mínimo de 8 caracteres" required /><small className={passwordValid ? "password-hint valid" : "password-hint"}>Use pelo menos 8 caracteres, com letras e números.</small></label><label>Confirmar senha<input autoComplete="new-password" type="password" value={form.confirmPassword} onChange={(e) => change("confirmPassword", e.target.value)} placeholder="Repita sua senha" required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary auth-submit" disabled={loading}>{loading ? "Criando espaço..." : "Criar conta"} {!loading && <ArrowRight size={16} />}</button></form>
    <p className="auth-footer">Já possui uma conta? <Link href="/login">Entrar</Link></p>
  </div><div className="auth-aside"><div><span className="eyebrow">LogiSense</span><h2>Uma base clara para uma operação mais eficiente.</h2><p>Comece com um espaço seguro para sua equipe analisar custos e comparar alternativas.</p></div><span className="auth-aside-foot">Seu primeiro usuário será administrador.</span></div></main>;
}
