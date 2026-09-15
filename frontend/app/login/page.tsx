"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { authErrorCode, authErrorMessage } from "../../lib/auth-errors";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const API_URL = API_BASE_URL.replace(/\/$/, "").endsWith("/api") ? API_BASE_URL.replace(/\/$/, "") : `${API_BASE_URL.replace(/\/$/, "")}/api`;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      await api.login(email, password, step === "mfa" ? totpCode : undefined);
      router.push("/dashboard");
    } catch (cause) {
      const code = authErrorCode(cause);
      if (code === "MFA_REQUIRED") setStep("mfa");
      setError(authErrorMessage(cause));
    } finally { setLoading(false); }
  }

  return <main className="auth-page">
    <div className="auth-panel">
      <Link href="/" className="auth-back"><ArrowLeft size={15} /> Voltar para o início</Link>
      <div className="auth-brand"><span className="brand-symbol">L</span><span>LogiSense</span></div>
      <div className="auth-heading"><span className="eyebrow"><LockKeyhole size={14} /> Acesso seguro</span><h1>{step === "mfa" ? "Confirme sua identidade." : "Bem-vindo de volta."}</h1><p>{step === "mfa" ? "Digite o código exibido no seu aplicativo autenticador." : "Entre para acompanhar sua operação logística."}</p></div>
      <form onSubmit={submit} className="auth-form">
        {step === "credentials" ? <><label>E-mail<input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" required /></label><label>Senha<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" required /></label><div className="auth-inline"><Link href="/forgot-password">Esqueci minha senha</Link></div></> : <label>Código de autenticação<input autoFocus inputMode="numeric" pattern="[0-9]{6}" value={totpCode} onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} required /></label>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" disabled={loading}>{loading ? "Verificando..." : step === "mfa" ? "Validar código" : "Entrar"} {!loading && <ArrowRight size={16} />}</button>
      </form>
      {step === "mfa" && <button className="auth-step-back" onClick={() => { setStep("credentials"); setError(""); }}>Voltar para credenciais</button>}
      {step === "credentials" && <><div className="auth-divider"><span>ou continue com</span></div><div className="oauth-actions"><a className="oauth-button" href={`${API_URL}/auth/google/authorize`}><span className="oauth-google">G</span> Google</a><a className="oauth-button" href={`${API_URL}/auth/github/authorize`}><span className="oauth-github">GH</span> GitHub</a></div></>}
      <p className="auth-footer">Ainda não possui acesso? <Link href="/register">Criar uma conta</Link></p>
    </div>
    <div className="auth-aside"><div><span className="eyebrow">LogiSense</span><h2>Decisões melhores começam com uma visão clara.</h2><p>Centralize seus custos, compare alternativas e acompanhe sua operação com tranquilidade.</p></div><span className="auth-aside-foot">Inteligência logística para decisões melhores.</span></div>
  </main>;
}
