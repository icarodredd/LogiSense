"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Clock3, FileUp, Loader2, RefreshCw, TriangleAlert, Upload, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DataPageShell } from "../../components/data-page";
import { SortableTable } from "../../components/sortable-table";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { api, ApiError, type ImportRecord, type ImportStatus, type ImportType } from "../../lib/api";

const typeLabels: Record<ImportType, string> = { CUSTOMERS: "Clientes", CARRIERS: "Transportadoras", SIMULATIONS: "Simulações" };
const statusLabels: Record<ImportStatus, string> = { PENDING: "Na fila", PROCESSING: "Processando", COMPLETED: "Concluído", FAILED: "Falhou" };

function statusIcon(status: ImportStatus) {
  if (status === "COMPLETED") return <CheckCircle2 size={15} />;
  if (status === "FAILED") return <XCircle size={15} />;
  if (status === "PROCESSING") return <Loader2 size={15} className="spin" />;
  return <Clock3 size={15} />;
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportsPage() {
  const [items, setItems] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<ImportType>("CUSTOMERS");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setError("");
    try {
      const response = await api.imports();
      const data = "data" in response ? response.data : response.items;
      setItems(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as importações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.me().then(({ user }) => setRole(user.role)).catch(() => setRole(null));
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!items.some((item) => item.status === "PENDING" || item.status === "PROCESSING")) return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [items]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Selecione um arquivo CSV ou XLSX.");
      return;
    }
    if (![".csv", ".xlsx"].some((extension) => file.name.toLowerCase().endsWith(extension))) {
      setError("A extensão deve ser .csv ou .xlsx.");
      return;
    }
    setUploading(true);
    setError("");
    setNotice("");
    try {
      await api.uploadImport(file, type);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setNotice("Importação criada. O processamento continuará em segundo plano.");
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  async function retry(id: string) {
    setError("");
    try {
      await api.retryImport(id);
      setNotice("Importação reenviada para processamento.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível reprocessar o arquivo.");
    }
  }

  const canUpload = role === "ADMIN" || role === "MANAGER";
  return <DataPageShell active="/imports"><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28 }}>
    <div className="page-heading"><div><span className="eyebrow">Operação em lote</span><h1>Importações</h1><p>Envie dados operacionais e acompanhe o processamento sem bloquear seu trabalho.</p></div><Button onClick={() => inputRef.current?.focus()} disabled={!canUpload}><Upload size={16} /> Nova importação</Button></div>
    {error && <div className="callout error-callout"><TriangleAlert size={15} /> {error}</div>}
    {notice && <div className="callout success-callout"><CheckCircle2 size={15} /> {notice}</div>}
    {!role && <div className="access-state"><Loader2 size={18} className="spin" /> Verificando suas permissões...</div>}
    {role && !canUpload && <div className="callout access-callout">Seu perfil pode acompanhar importações, mas apenas administradores e gestores podem enviar ou reprocessar arquivos.</div>}
    {canUpload && <form className="import-upload panel" onSubmit={submit}><div><span className="eyebrow">Upload seguro</span><h2>Adicionar arquivo</h2><p>CSV ou XLSX, até 10 MB. Escolha o tipo de registro antes de enviar.</p></div><div className="import-form-row"><label className="file-drop"><FileUp size={21} /><span>{file ? file.name : "Escolher arquivo"}</span><small>{file ? formatBytes(file.size) : "Clique para procurar no dispositivo"}</small><input ref={inputRef} type="file" accept=".csv,.xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><label className="import-select">Tipo<select value={type} onChange={(event) => setType(event.target.value as ImportType)}><option value="CUSTOMERS">Clientes</option><option value="CARRIERS">Transportadoras</option><option value="SIMULATIONS">Simulações</option></select></label><Button disabled={uploading || !file}>{uploading ? <><Loader2 size={16} className="spin" /> Enviando...</> : <><Upload size={16} /> Enviar arquivo</>}</Button></div></form>}
    <div className="panel import-list-panel"><div className="panel-heading"><div><h2>Arquivos recentes</h2><p>Atualização automática durante o processamento.</p></div><button className="icon-button" onClick={() => void load()} aria-label="Atualizar importações"><RefreshCw size={16} /></button></div>{loading ? <div className="import-skeletons">{[1, 2, 3].map((item) => <div className="table-skeleton" key={item} />)}</div> : !items.length ? <div className="empty-table"><FileUp size={25} /><strong>Nenhuma importação ainda</strong><span>Envie um arquivo para começar a alimentar sua operação.</span></div> : <div className="import-table-wrap"><SortableTable><thead><tr><th>Arquivo</th><th>Tipo</th><th>Progresso</th><th>Status</th><th>Data</th><th /></tr></thead><tbody>{items.map((item) => { const percentage = item.totalRows ? Math.min(100, Math.round((item.processedRows / item.totalRows) * 100)) : item.status === "COMPLETED" ? 100 : 0; return <tr key={item.id}><td><strong>{item.filename}</strong><small>{formatBytes(item.sizeBytes)}</small></td><td>{typeLabels[item.type]}</td><td><div className="import-progress"><div><span>{item.processedRows} de {item.totalRows || "—"} linhas</span><strong>{percentage}%</strong></div><i><b style={{ width: `${percentage}%` }} /></i></div></td><td><Badge className={`import-status status-${item.status.toLowerCase()}`}>{statusIcon(item.status)} {statusLabels[item.status]}</Badge>{item.errorMessage && <small className="import-error">{item.errorMessage}</small>}</td><td>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</td><td>{item.status === "FAILED" && canUpload && <button className="text-link" onClick={() => void retry(item.id)}>Reprocessar</button>}</td></tr>; })}</tbody></SortableTable></div>}</div>
  </motion.div></DataPageShell>;
}
