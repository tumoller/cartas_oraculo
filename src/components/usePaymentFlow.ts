"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PricedSpread } from "@/lib/pricing";
import type { PublicPayment } from "@/lib/payments";

// Fluxo do checkout da InfinitePay, compartilhado pelo modal das cartas e pelo dos produtos.
export type PayStep = "form" | "waiting" | "paid" | "declined";
const POLL_MS = 4000;
const PAID_HOLD_MS = 2600;
const storeKey = (id: string) => `oracle_payment_${id}`;

type Options = { isOpen: boolean; kind: "unlock" | "prepaid"; readingId: string; spread: PricedSpread; onPaid: (payment: PublicPayment) => void };

export function usePaymentFlow({ isOpen, kind, readingId, spread, onPaid }: Options) {
  const [step, setStep] = useState<PayStep>("form");
  const [payment, setPayment] = useState<PublicPayment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paidRef = useRef(false);
  const onPaidRef = useRef(onPaid);
  useEffect(() => { onPaidRef.current = onPaid; }, [onPaid]);

  const apply = useCallback((next: PublicPayment) => {
    setPayment(next);
    if (next.status === "PAID") {
      setStep("paid");
      // A chave fica: se a abertura da mesa falhar, reabrir o pagamento retoma como pago, sem novo Pix.
      if (!paidRef.current) {
        paidRef.current = true;
        navigator.vibrate?.([20, 60, 20]);
        window.setTimeout(() => onPaidRef.current(next), PAID_HOLD_MS);
      }
    } else if (next.status === "DECLINED" || next.status === "EXPIRED") {
      setStep("declined");
      try { localStorage.removeItem(storeKey(readingId)); } catch {}
    } else {
      setStep("waiting");
    }
  }, [readingId]);

  // Retoma um pagamento em andamento (a pessoa volta da página da InfinitePay).
  useEffect(() => {
    if (!isOpen) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(storeKey(readingId)); } catch {}
    if (!saved) return;
    fetch(`/api/payment/${saved}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PublicPayment | null) => { if (data && data.readingId === readingId) apply(data); })
      .catch(() => {});
  }, [isOpen, readingId, apply]);

  // Aguarda a confirmação (o webhook confirma no servidor): consulta a cada 4s, ao voltar para a aba
  // e na hora em que a janela de pagamento avisa que terminou.
  useEffect(() => {
    if (!isOpen || step !== "waiting" || !payment) return;
    const check = () => {
      fetch(`/api/payment/${payment.id}`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: PublicPayment | null) => { if (data && data.status !== "PENDING") apply(data); })
        .catch(() => {});
    };
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") check(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.data?.type === "oracle-payment-return" && event.data.id === payment.id) check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("message", onMessage);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("message", onMessage); };
  }, [isOpen, step, payment, apply]);

  // A página da InfinitePay abre numa janela/aba separada e a cena fica aguardando aqui.
  // A janela é aberta já no toque (antes do fetch) para o navegador não bloquear o pop-up.
  const openCheckout = (url: string, win?: Window | null) => {
    const target = win ?? window.open("", "oracle-checkout", "popup,width=480,height=760");
    if (target) { target.location.href = url; target.focus(); return true; }
    return false;
  };

  const pay = async () => {
    setBusy(true); setError(null);
    const win = window.open("", "oracle-checkout", "popup,width=480,height=760");
    try {
      const res = await fetch("/api/payment/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, readingId, spread }),
      });
      const data: PublicPayment & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível abrir o pagamento.");
      if (data.status === "PAID") { win?.close(); return apply(data); }
      if (!data.checkoutUrl) throw new Error("Não foi possível abrir o pagamento.");
      try { localStorage.setItem(storeKey(readingId), data.id); } catch {}
      // Pop-up bloqueado: segue na mesma aba (o retorno reabre a consulta).
      if (!openCheckout(data.checkoutUrl, win)) return window.location.assign(data.checkoutUrl);
      apply(data);
      setBusy(false);
    } catch (err) {
      win?.close();
      setError(err instanceof Error ? err.message : "Não foi possível abrir o pagamento.");
      setBusy(false);
    }
  };

  const retry = () => { setPayment(null); setStep("form"); setError(null); setBusy(false); paidRef.current = false; };

  const reopen = () => { if (payment?.checkoutUrl && !openCheckout(payment.checkoutUrl)) window.location.assign(payment.checkoutUrl); };

  // Só no `npm run dev`: registra o pagamento como pago sem passar pela InfinitePay (em produção é undefined).
  const simulate = process.env.NODE_ENV === "development" ? async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/payment/simulate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, readingId, spread }),
      });
      const data: PublicPayment & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || "Simulação falhou.");
      apply(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulação falhou.");
    } finally { setBusy(false); }
  } : undefined;

  return { step, payment, busy, error, pay, retry, reopen, simulate };
}
