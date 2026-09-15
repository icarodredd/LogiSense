"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.login(email, password, needsMfa ? totpCode : undefined);
      router.push("/dashboard");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível entrar.";
      if (message.toLowerCase().includes("mfa")) setNeedsMfa(true);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-page">
    <div className="auth-panel">
      <Link href="/" className="auth-back"><ArrowLeft size={15} /> Voltar para o início</Link>
      <div className="auth-brand"><span className="brand-symbol">L</span><span>LogiSense</span></div>
      <div className="auth-heading"><span className="eyebrow"><LockKeyhole size={14} /> Acesso seguro</span><h1>Bem-vindo de volta.</h1><p>Entre para acompanhar sua operação logística.</p></div>
      <form onSubmit={submit} className="auth-form">
        <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" required /></label>
        <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" required /></label>
        {needsMfa && <label>Código de autenticação<input inputMode="numeric" value={totpCode} onChange={(event) => setTotpCode(event.target.value)} placeholder="000000" maxLength={6} required /></label>}
        {error && <p className="form-error">{error}</p>}
        <button className="button button-primary auth-submit" disabled={loading}>{loading ? "Verificando..." : "Entrar"} {!loading && <ArrowRight size={16} />}</button>
      </form>
      <p className="auth-footer">Ainda não possui acesso? <Link href="/register">Criar uma conta</Link></p>
    </div>
    <div className="auth-aside"><div><span className="eyebrow">LogiSense</span><h2>Decisões melhores começam com uma visão clara.</h2><p>Centralize seus custos, compare alternativas e acompanhe sua operação com tranquilidade.</p></div><span className="auth-aside-foot">Inteligência logística para decisões melhores.</span></div>
  </main>;
}
