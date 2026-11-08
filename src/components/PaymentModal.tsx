"use client";

import { createPortal } from "react-dom";
import { sceneAssets, paymentLoops } from "@/lib/scene-assets";
import { formatBRL, PRICES, type PricedSpread } from "@/lib/pricing";
import type { PublicPayment } from "@/lib/payments";
import styles from "./PaymentModal.module.css";
import { usePaymentFlow, type PayStep } from "./usePaymentFlow";

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

type Step = PayStep;

const LINES: Record<Step, string> = {
  form: "Toda consulta pede uma troca. Faça o pagamento e eu abro as cartas para você.",
  waiting: "Estou sentindo a sua energia chegar… assim que o pagamento for confirmado, as cartas falam.",
  paid: "Recebido. Vamos consultar a sua sorte.",
  declined: "O pagamento não chegou até mim. Quer tentar de novo?",
};
export function PaymentModal({ isOpen, onClose, persona, kind, readingId, spread, onPaid }: Props) {
  const assets = sceneAssets(persona);
  const loops = paymentLoops(persona);
  const { step, payment, busy, error, pay, retry, reopen } = usePaymentFlow({ isOpen, kind, readingId, spread, onPaid });

  if (!isOpen || typeof document === "undefined") return null;

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
              <button type="button" className={styles.secondary} onClick={reopen}>Reabrir a página de pagamento</button>
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
