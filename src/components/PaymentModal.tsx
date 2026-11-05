"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sceneAssets, paymentLoops } from "@/lib/scene-assets";
import { formatBRL, PRICES, type PricedSpread } from "@/lib/pricing";
import type { PublicPayment } from "@/lib/payments";
import styles from "./PaymentModal.module.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  persona: string;
  kind: "unlock" | "prepaid";
  /** Leitura a abrir (unlock) ou requestId da consulta que será criada (prepaid). */
  readingId: string;
  spread: PricedSpread;
  onPaid: (payment: PublicPayment) => void;
};

type Step = "form" | "waiting" | "paid" | "declined";
const POLL_MS = 4000;
const PAID_HOLD_MS = 2600;
const storeKey = (id: string) => `oracle_payment_${id}`;

const LINES: Record<Step, string> = {
  form: "Toda consulta pede uma troca. Faça o pagamento e eu abro as cartas para você.",
  waiting: "Estou sentindo a sua energia chegar… assim que o pagamento for confirmado, as cartas falam.",
  paid: "Recebido. Vamos consultar a sua sorte.",
  declined: "O pagamento não chegou até mim. Quer tentar de novo?",
};

export function PaymentModal({ isOpen, onClose, persona, kind, readingId, spread, onPaid }: Props) {
  const assets = sceneAssets(persona);
  const loops = paymentLoops(persona);
  const [step, setStep] = useState<Step>("form");
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

  if (!isOpen || typeof document === "undefined") return null;

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

  const mood = step === "paid" ? "paid" : step === "declined" ? "declined" : "waiting";
  const still = mood === "paid" ? assets.sceneExpressing : mood === "declined" ? assets.sceneConcentrating : assets.scene;
  const loop = loops[mood];
  const amount = payment?.amount ?? PRICES[spread];

  // Portal: fora de qualquer contexto de empilhamento da página/cena.
  return createPortal(
    <div className={styles.root} data-mood={mood} role="dialog" aria-modal="true" aria-labelledby="payment-title">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={still} alt="" aria-hidden="true" className={styles.backdrop} />
      <div className={styles.face} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={still} src={still} alt="" className={styles.faceImg} />
        {loop && <video key={loop} className={styles.faceImg} src={loop} autoPlay muted loop={mood === "waiting"} playsInline />}
        <div className={styles.faceShade} />
      </div>

      {step !== "paid" && (
        <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar pagamento">✕</button>
      )}

      <p className={styles.line} key={step}>“{LINES[step]}”</p>

      <div className={styles.sheet}>
        <h2 id="payment-title" className={styles.title}>
          {step === "paid" ? "Pagamento confirmado" : step === "declined" ? "Pagamento não confirmado" : kind === "unlock" ? "Abrir a leitura completa" : "Abrir sua mesa"}
        </h2>
        <p className={styles.price}>{formatBRL(amount)} <span>· Pix ou cartão</span></p>

        {step === "form" && (
          <div className={styles.form}>
            <button type="button" className={styles.primary} onClick={pay} disabled={busy}>
              {busy ? "Abrindo o pagamento…" : `Pagar ${formatBRL(amount)}`}
            </button>
            <p className={styles.note}>Você paga com Pix ou cartão na página segura da InfinitePay e volta para cá. Seus dados ficam só com ela.</p>
          </div>
        )}

        {step === "waiting" && payment && (
          <div className={styles.form}>
            <p className={styles.waiting}><span className={styles.dot} /> Aguardando a confirmação…</p>
            {payment.checkoutUrl && (
              <button type="button" className={styles.secondary} onClick={() => { if (!openCheckout(payment.checkoutUrl!)) window.location.assign(payment.checkoutUrl!); }}>Reabrir a página de pagamento</button>
            )}
            <p className={styles.note}>Conclua o pagamento na página da InfinitePay que abriu. Pode deixar esta tela aberta: assim que o pagamento for confirmado, a mesa abre aqui sozinha.</p>
          </div>
        )}

        {step === "paid" && <p className={styles.waiting}>Abrindo a sua mesa…</p>}

        {step === "declined" && (
          <div className={styles.form}>
            <button type="button" className={styles.primary} onClick={retry}>Tentar de novo</button>
            <button type="button" className={styles.secondary} onClick={onClose}>Agora não</button>
          </div>
        )}

        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
    </div>,
    document.body,
  );
}
