import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  return <main className="auth-page"><div className="auth-panel"><Link href="/login" className="auth-back"><ArrowLeft size={15} /> Voltar para o login</Link><div className="auth-brand"><span className="brand-symbol">L</span><span>LogiSense</span></div><div className="auth-heading"><span className="eyebrow"><Mail size={14} /> Recuperação de acesso</span><h1>Precisa de ajuda?</h1><p>O fluxo de recuperação de senha ainda depende da API de redefinição, que não está disponível no backend atual.</p></div><div className="auth-info-box"><strong>Fale com o administrador da empresa</strong><span>Peça a redefinição do seu acesso enquanto esse fluxo é disponibilizado na plataforma.</span></div><Link href="/login" className="button button-primary auth-submit">Voltar para entrar</Link></div><div className="auth-aside"><div><span className="eyebrow">LogiSense</span><h2>Acesso seguro também é saber quando pedir ajuda.</h2><p>Não simulamos o envio de e-mails enquanto o serviço de recuperação não está disponível.</p></div></div></main>;
}
