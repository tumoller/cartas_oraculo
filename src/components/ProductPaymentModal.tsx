"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, Lock, X } from "lucide-react";
import { formatBRL, PRICES, type ProductKey } from "@/lib/pricing";
import type { PublicPayment } from "@/lib/payments";
import { usePaymentFlow } from "./usePaymentFlow";
import styles from "./ProductPaymentModal.module.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  readingId: string;
  product: ProductKey;
  firstName: string;
  /** Títulos das seções que o pagamento abre. */
  includes: string[];
  onPaid: (payment: PublicPayment) => void;
};

const HEAD: Record<ProductKey, string> = {
  "mapa-completo": "Revele o seu mapa completo",
  "mapa-simples": "Revele o seu mapa completo",
  numerologia: "Revele todos os seus números",
};

/** Pagamento do mapa astral e da numerologia: sem persona nem cena, só a oferta e o checkout. */
export function ProductPaymentModal({ isOpen, onClose, readingId, product, firstName, includes, onPaid }: Props) {
  const { step, payment, busy, error, pay, retry, reopen } = usePaymentFlow({ isOpen, kind: "unlock", readingId, spread: product, onPaid });
  const amount = payment?.amount ?? PRICES[product];

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && step !== "paid") onClose(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [isOpen, step, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className={`ed-vars ${styles.root}`} role="dialog" aria-modal="true" aria-labelledby="pp-title">
      <button type="button" className={styles.scrim} aria-label="Fechar" onClick={step !== "paid" ? onClose : undefined} tabIndex={-1} />
      <div className={styles.sheet}>
        {step !== "paid" && (
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar pagamento"><X size={20} aria-hidden /></button>
        )}

        {/* Espaço da arte de abertura (a arte final entra aqui). */}
        <div className={styles.art} aria-hidden="true">
          <span className={styles.ring} />
          <span className={styles.ring2} />
          <span className={styles.star}>✦&#xFE0E;</span>
        </div>

        {step === "form" && (
          <>
            <p className={styles.eyebrow}>{firstName}, falta pouco</p>
            <h2 id="pp-title" className={styles.title}>{HEAD[product]}</h2>
            <ul className={styles.list}>
              {includes.map((t) => <li key={t}><Check size={16} aria-hidden /> {t}</li>)}
            </ul>
            <p className={styles.price}>{formatBRL(amount)}<span>pagamento único · Pix ou cartão</span></p>
            <button type="button" className={styles.primary} onClick={pay} disabled={busy}>
              {busy ? "Abrindo o pagamento…" : "Abrir minha leitura completa"}
            </button>
            <p className={styles.note}><Lock size={13} aria-hidden /> Você paga na página segura da InfinitePay e volta para cá. Seus dados de pagamento ficam só com ela.</p>
          </>
        )}

        {step === "waiting" && (
          <>
            <h2 id="pp-title" className={styles.title}>Aguardando o pagamento</h2>
            <p className={styles.waiting}><span className={styles.dot} /> Assim que a InfinitePay confirmar, a sua leitura abre aqui sozinha.</p>
            {payment?.checkoutUrl && <button type="button" className={styles.secondary} onClick={reopen}>Reabrir a página de pagamento</button>}
            <p className={styles.note}>Pode deixar esta tela aberta enquanto paga.</p>
          </>
        )}

        {step === "paid" && (
          <>
            <h2 id="pp-title" className={styles.title}>Pagamento confirmado</h2>
            <p className={styles.waiting}>Abrindo a sua leitura completa…</p>
          </>
        )}

        {step === "declined" && (
          <>
            <h2 id="pp-title" className={styles.title}>Pagamento não confirmado</h2>
            <p className={styles.note}>O pagamento não foi concluído. Você pode tentar de novo.</p>
            <button type="button" className={styles.primary} onClick={retry}>Tentar de novo</button>
            <button type="button" className={styles.secondary} onClick={onClose}>Agora não</button>
          </>
        )}

        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
    </div>,
    document.body,
  );
}
