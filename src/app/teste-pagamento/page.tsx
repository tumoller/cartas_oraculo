"use client";

import { useEffect, useState } from "react";

type TestPayment = { id: string; status: string; pixText: string | null; pixImage: string | null; amount: number; webhook?: boolean };

// Página interna: Pix REAL de valor baixo para validar produção e webhook. Exige ?chave=PAGBANK_TEST_KEY.
export default function TestePagamento() {
  const [key, setKey] = useState("");
  const [cents, setCents] = useState("1,00");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [payment, setPayment] = useState<TestPayment | null>(null);
  const [webhookSeen, setWebhookSeen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Lê ?chave= só no cliente (página estática).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKey(new URLSearchParams(location.search).get("chave") || "");
  }, []);

  // Só lê o banco: se virar PAID sozinho, foi o webhook do PagBank que avisou.
  useEffect(() => {
    if (!payment || payment.status !== "PENDING") return;
    const timer = window.setInterval(async () => {
      const res = await fetch(`/api/payment/test?key=${encodeURIComponent(key)}&id=${payment.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status !== "PENDING") { setWebhookSeen(true); setPayment(data); }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [payment, key]);

  const create = async () => {
    setBusy(true); setError(null);
    try {
      const value = Math.round(Number(cents.replace(",", ".")) * 100);
      const res = await fetch("/api/payment/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, cents: value, name, email, cpf }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPayment(data); setWebhookSeen(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha."); }
    finally { setBusy(false); }
  };

  const refresh = async () => {
    if (!payment) return;
    const res = await fetch(`/api/payment/test?key=${encodeURIComponent(key)}&id=${payment.id}&refresh=1`, { cache: "no-store" });
    if (res.ok) setPayment(await res.json());
  };

  const input = "w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-base";
  return (
    <main className="mx-auto max-w-md p-5 text-slate-100 space-y-4">
      <h1 className="text-xl font-bold">Teste de Pix real (produção)</h1>
      <p className="text-sm text-slate-400">Cobra de verdade na conta PagBank de produção. Não libera leitura. Use só para validar a cobrança e o aviso automático (webhook).</p>
      {!payment && (
        <div className="space-y-3">
          <input className={input} placeholder="Chave de teste" value={key} onChange={(e) => setKey(e.target.value)} />
          <input className={input} placeholder="Valor (R$)" value={cents} onChange={(e) => setCents(e.target.value)} inputMode="decimal" />
          <input className={input} placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={input} placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={input} placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} inputMode="numeric" />
          <button type="button" onClick={create} disabled={busy} className="w-full rounded-lg bg-amber-500 py-3 font-bold text-slate-950 disabled:opacity-50">{busy ? "Gerando…" : "Gerar Pix real"}</button>
        </div>
      )}
      {payment && (
        <div className="space-y-3 text-center">
          <p className="text-2xl font-bold">{(payment.amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
          <p>Status: <strong>{payment.status}</strong></p>
          {payment.status === "PENDING" && payment.pixImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payment.pixImage} alt="QR code" className="mx-auto h-56 w-56 rounded-lg bg-white p-2" style={{ imageRendering: "pixelated" }} />
          )}
          {payment.status === "PENDING" && payment.pixText && (
            <button type="button" onClick={() => navigator.clipboard.writeText(payment.pixText!)} className="w-full rounded-lg bg-amber-500 py-3 font-bold text-slate-950">Copiar código Pix</button>
          )}
          {payment.webhook === false && <p className="text-sm text-rose-300">Sem URL pública (https): o webhook não foi cadastrado neste pedido.</p>}
          {payment.status === "PAID" && <p className="text-emerald-300">{webhookSeen ? "Confirmado pelo webhook do PagBank ✓" : "Confirmado pela consulta manual (o webhook ainda não tinha chegado)."}</p>}
          <button type="button" onClick={refresh} className="w-full rounded-lg border border-slate-500 py-2 text-sm">Consultar no PagBank agora</button>
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-rose-950 p-3 text-sm text-rose-200">{error}</p>}
    </main>
  );
}
