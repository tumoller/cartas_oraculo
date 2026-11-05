import { createHash, timingSafeEqual } from "node:crypto";

// Cliente mínimo da API de pedidos do PagBank (Pix por QR code).
// Testado no sandbox em 04/11/2026: customer exige name, email e tax_id; o checkout hospedado devolvia 500.
// prod=true força produção com PAGBANK_PROD_TOKEN (página de teste do Pix real, mesmo com o site em sandbox).
const base = (prod = false) => prod || process.env.PAGBANK_ENV === "production" ? "https://api.pagseguro.com" : "https://sandbox.api.pagseguro.com";
export const pagbankSandbox = () => process.env.PAGBANK_ENV !== "production";

function headers(prod = false) {
  const token = prod ? process.env.PAGBANK_PROD_TOKEN : process.env.PAGBANK_TOKEN;
  if (!token) throw new Error(prod ? "PAGBANK_PROD_TOKEN não configurado." : "PAGBANK_TOKEN não configurado.");
  // Sem User-Agent o Cloudflare do PagBank bloqueia a requisição (403 HTML).
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json", "User-Agent": "CartasOraculo/1.0" };
}

type Link = { rel: string; href: string };
export type PagbankOrder = {
  id: string;
  reference_id?: string;
  qr_codes?: { text?: string; expiration_date?: string; links?: Link[] }[];
  charges?: { status?: string; amount?: { value?: number } }[];
};

export async function createPixOrder(input: { referenceId: string; amount: number; itemName: string; name: string; email: string; taxId: string; notificationUrl?: string; expiresAt: Date; prod?: boolean }) {
  const body = {
    reference_id: input.referenceId,
    customer: { name: input.name, email: input.email, tax_id: input.taxId },
    items: [{ reference_id: input.referenceId, name: input.itemName, quantity: 1, unit_amount: input.amount }],
    qr_codes: [{ amount: { value: input.amount }, expiration_date: input.expiresAt.toISOString() }],
    ...(input.notificationUrl ? { notification_urls: [input.notificationUrl] } : {}),
  };
  const res = await fetch(`${base(input.prod)}/orders`, { method: "POST", headers: headers(input.prod), body: JSON.stringify(body), cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`PagBank ${res.status}: ${text.slice(0, 300)}`);
  const order = JSON.parse(text) as PagbankOrder;
  const qr = order.qr_codes?.[0];
  return {
    orderId: order.id,
    pixText: qr?.text ?? null,
    pixImage: qr?.links?.find((link) => link.rel === "QRCODE.PNG")?.href ?? null,
  };
}

export async function getOrder(orderId: string, prod = false): Promise<PagbankOrder> {
  if (!/^ORDE_[A-F0-9-]{36}$/i.test(orderId)) throw new Error("ID de pedido inválido.");
  const res = await fetch(`${base(prod)}/orders/${orderId}`, { headers: headers(prod), cache: "no-store" });
  if (!res.ok) throw new Error(`PagBank ${res.status}`);
  return res.json();
}

/** Estado da cobrança a partir do pedido consultado na API (nunca do corpo do webhook). */
export function orderStatus(order: PagbankOrder, amount: number): "PAID" | "DECLINED" | "PENDING" {
  const charges = order.charges ?? [];
  if (charges.some((charge) => charge.status === "PAID" && (charge.amount?.value ?? 0) >= amount)) return "PAID";
  if (charges.length > 0 && charges.every((charge) => charge.status === "DECLINED" || charge.status === "CANCELED")) return "DECLINED";
  return "PENDING";
}

/** x-authenticity-token = sha256("{token}-{corpo bruto}"). Só informativo: o status sempre é reconsultado na API. */
export function validSignature(rawBody: string, header: string | null): boolean {
  if (!header || !/^[a-f0-9]{64}$/i.test(header)) return false;
  const received = Buffer.from(header.toLowerCase(), "hex");
  return [process.env.PAGBANK_TOKEN, process.env.PAGBANK_PROD_TOKEN].some((token) =>
    Boolean(token) && timingSafeEqual(createHash("sha256").update(`${token}-${rawBody}`, "utf8").digest(), received));
}

let cachedKey: { key: string; env: string } | null = null;
/** Chave pública para o navegador criptografar o cartão (o número nunca passa pelo nosso servidor). */
export async function getCardPublicKey(): Promise<string> {
  const env = process.env.PAGBANK_ENV || "sandbox";
  if (cachedKey?.env === env) return cachedKey.key;
  const res = await fetch(`${base()}/public-keys`, { method: "POST", headers: headers(), body: JSON.stringify({ type: "card" }), cache: "no-store" });
  if (!res.ok) throw new Error(`PagBank ${res.status}`);
  const { public_key } = await res.json() as { public_key?: string };
  if (!public_key) throw new Error("Chave pública ausente.");
  cachedKey = { key: public_key, env };
  return public_key;
}

export async function createCardOrder(input: { referenceId: string; amount: number; itemName: string; name: string; email: string; taxId: string; encrypted: string; holderName: string; notificationUrl?: string }) {
  const body = {
    reference_id: input.referenceId,
    customer: { name: input.name, email: input.email, tax_id: input.taxId },
    items: [{ reference_id: input.referenceId, name: input.itemName, quantity: 1, unit_amount: input.amount }],
    charges: [{
      reference_id: input.referenceId,
      description: input.itemName,
      amount: { value: input.amount, currency: "BRL" },
      payment_method: {
        type: "CREDIT_CARD", installments: 1, capture: true, soft_descriptor: "CartasOraculo",
        card: { encrypted: input.encrypted, store: false },
        holder: { name: input.holderName, tax_id: input.taxId },
      },
    }],
    ...(input.notificationUrl ? { notification_urls: [input.notificationUrl] } : {}),
  };
  const res = await fetch(`${base()}/orders`, { method: "POST", headers: headers(), body: JSON.stringify(body), cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`PagBank ${res.status}: ${text.slice(0, 300)}`);
  const order = JSON.parse(text) as PagbankOrder & { charges?: { status?: string; amount?: { value?: number }; payment_response?: { message?: string } }[] };
  return { orderId: order.id, status: orderStatus(order, input.amount), message: order.charges?.[0]?.payment_response?.message ?? null };
}
