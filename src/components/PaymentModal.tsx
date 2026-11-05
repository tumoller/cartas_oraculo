"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sceneAssets, paymentLoops } from "@/lib/scene-assets";
import { formatBRL, PRICES, validCpf, type PricedSpread } from "@/lib/pricing";
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
  defaultName?: string;
  onPaid: (payment: PublicPayment) => void;
};

type Step = "form" | "pix" | "paid" | "declined";
const POLL_MS = 4000;
const PAID_HOLD_MS = 2600;
const storeKey = (id: string) => `oracle_payment_${id}`;
const sandbox = process.env.NEXT_PUBLIC_PAGBANK_ENV !== "production";

const LINES: Record<Step, string> = {
  form: "Toda consulta pede uma troca. Faça o Pix e eu abro as cartas para você.",
  pix: "Estou aguardando. Assim que o Pix chegar, as cartas falam.",
  paid: "Recebido. Vamos consultar a sua sorte.",
  declined: "O pagamento não chegou até mim. Quer tentar de novo?",
};

type PagSeguroSdk = { encryptCard: (input: Record<string, string>) => { encryptedCard?: string; hasErrors: boolean; errors?: { code: string; message: string }[] } };
const SDK_URL = "https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js";

/** Criptografa o cartão no navegador com a SDK oficial do PagBank; o número nunca chega ao nosso servidor. */
async function encryptCard(card: { number: string; holder: string; expMonth: string; expYear: string; securityCode: string }) {
  const win = window as unknown as { PagSeguro?: PagSeguroSdk };
  if (!win.PagSeguro) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Não consegui carregar o módulo de cartão. Tente o Pix."));
      document.head.appendChild(script);
    });
  }
  const res = await fetch("/api/payment/card");
  const { publicKey, error } = await res.json();
  if (!res.ok || !publicKey) throw new Error(error || "Cartão indisponível agora. Use o Pix.");
  const result = win.PagSeguro!.encryptCard({ publicKey, ...card });
  if (result.hasErrors || !result.encryptedCard) throw new Error("Confira os dados do cartão.");
  return result.encryptedCard;
}

const formatCpf = (value: string) => value.replace(/\D/g, "").slice(0, 11)
  .replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");

export function PaymentModal({ isOpen, onClose, persona, kind, readingId, spread, defaultName = "", onPaid }: Props) {
  const assets = sceneAssets(persona);
  const loops = paymentLoops(persona);
  const [step, setStep] = useState<Step>("form");
  const [payment, setPayment] = useState<PublicPayment | null>(null);
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [declineReason, setDeclineReason] = useState<string | null>(null);
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
      setStep("pix");
    }
  }, [readingId]);

  // Retoma um Pix em andamento (a pessoa pode ter ido ao app do banco e voltado).
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

  // Consulta o status enquanto o QR está na tela.
  useEffect(() => {
    if (!isOpen || step !== "pix" || !payment) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/payment/${payment.id}`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: PublicPayment | null) => { if (data && data.status !== "PENDING") apply(data); })
        .catch(() => {});
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [isOpen, step, payment, apply]);

  if (!isOpen || typeof document === "undefined") return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError("Informe seu nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Informe um e-mail válido.");
    if (!validCpf(cpf)) return setError("Confira o CPF.");
    setBusy(true); setError(null); setDeclineReason(null);
    try {
      let payload: Record<string, unknown> = { kind, readingId, spread, name, email, cpf };
      if (method === "card") {
        const [month, year] = cardExp.split("/");
        if (cardNumber.replace(/\D/g, "").length < 13 || !month || !year || cardCvv.length < 3 || !cardName.trim()) throw new Error("Confira os dados do cartão.");
        const encrypted = await encryptCard({ number: cardNumber.replace(/\D/g, ""), holder: cardName.trim(), expMonth: month, expYear: `20${year}`, securityCode: cardCvv });
        payload = { ...payload, encrypted, holderName: cardName.trim() };
      }
      const res = await fetch(`/api/payment/${method}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível concluir o pagamento.");
      if (data.status === "PENDING") { try { localStorage.setItem(storeKey(readingId), data.id); } catch {} }
      if (data.message) setDeclineReason(data.message);
      apply(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir o pagamento.");
    } finally { setBusy(false); }
  };

  const copy = async () => {
    if (!payment?.pixText) return;
    try { await navigator.clipboard.writeText(payment.pixText); setCopied(true); window.setTimeout(() => setCopied(false), 2500); }
    catch { setError("Não consegui copiar. Segure o código para copiar manualmente."); }
  };

  const simulate = async (result: "PAID" | "DECLINED") => {
    if (!payment) return;
    const res = await fetch(`/api/payment/${payment.id}/simulate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ result }) });
    if (res.ok) apply(await res.json());
  };

  const retry = () => { setPayment(null); setStep("form"); setError(null); paidRef.current = false; };

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
        <p className={styles.price}>{formatBRL(amount)} <span>· {method === "card" ? "cartão à vista" : "Pix"}</span></p>

        {step === "form" && (
          <form onSubmit={submit} className={styles.form}>
            <div className={styles.methods} role="group" aria-label="Forma de pagamento">
              <button type="button" aria-pressed={method === "pix"} onClick={() => setMethod("pix")}>Pix</button>
              <button type="button" aria-pressed={method === "card"} onClick={() => setMethod("card")}>Cartão de crédito</button>
            </div>
            <label>Nome completo<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} /></label>
            <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" maxLength={120} /></label>
            <label>CPF<input value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" /></label>
            {method === "card" && (
              <>
                <label>Número do cartão<input value={cardNumber} onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 "))} inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" /></label>
                <label>Nome impresso no cartão<input value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} autoComplete="cc-name" maxLength={80} /></label>
                <div className={styles.row}>
                  <label>Validade<input value={cardExp} onChange={(e) => setCardExp(e.target.value.replace(/\D/g, "").slice(0, 4).replace(/(\d{2})(\d)/, "$1/$2"))} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" /></label>
                  <label>CVV<input value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="cc-csc" placeholder="123" /></label>
                </div>
              </>
            )}
            <p className={styles.note}>{method === "card"
              ? "Pagamento à vista. O cartão é criptografado no seu aparelho e vai direto ao PagBank."
              : "O PagBank exige CPF e e-mail para emitir o Pix. Não guardamos o seu CPF."}</p>
            <button type="submit" className={styles.primary} disabled={busy}>
              {busy ? (method === "card" ? "Processando…" : "Gerando Pix…") : (method === "card" ? `Pagar ${formatBRL(amount)}` : "Gerar Pix")}
            </button>
          </form>
        )}

        {step === "pix" && payment && (
          <div className={styles.pix}>
            {payment.pixImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={payment.pixImage} alt="QR code do Pix" className={styles.qr} />
            )}
            <button type="button" className={styles.primary} onClick={copy}>{copied ? "Código copiado ✓" : "Copiar código Pix"}</button>
            <p className={styles.waiting}><span className={styles.dot} /> Aguardando o pagamento…</p>
            <p className={styles.note}>Pague no app do seu banco com o QR ou o copia e cola. Pode voltar para cá: a mesa abre sozinha.</p>
            {sandbox && (
              <div className={styles.sandbox}>
                <span>Teste (sandbox):</span>
                <button type="button" onClick={() => simulate("PAID")}>Simular aprovado</button>
                <button type="button" onClick={() => simulate("DECLINED")}>Simular recusado</button>
              </div>
            )}
          </div>
        )}

        {step === "paid" && <p className={styles.waiting}>Abrindo a sua mesa…</p>}

        {step === "declined" && (
          <div className={styles.form}>
            {declineReason && <p className={styles.note}>Motivo informado pelo banco: {declineReason.toLowerCase()}.</p>}
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
