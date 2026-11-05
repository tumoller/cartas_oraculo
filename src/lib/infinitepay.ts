// Checkout integrado da InfinitePay: https://www.infinitepay.io/checkout-documentacao
// O cliente paga (Pix ou cartão) na página da InfinitePay e volta para o site.
// Não há sandbox nem assinatura no webhook: todo aviso é confirmado no /payment_check.
const BASE = "https://api.checkout.infinitepay.io";

export const infinitePayHandle = () => process.env.INFINITEPAY_HANDLE?.replace(/^\$/, "").trim() || "";

/** Guardado em Payment.orderId depois que a InfinitePay informa a transação. */
export const infinitePayRef = (slug: string, transactionNsu: string) => `ip:${slug}:${transactionNsu}`;
export function parseInfinitePayRef(orderId: string | null) {
  const match = orderId?.match(/^ip:([^:]+):(.+)$/);
  return match ? { slug: match[1], transactionNsu: match[2] } : null;
}

async function call(path: string, body: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (process.env.INFINITEPAY_API_KEY) headers["X-Api-Key"] = process.env.INFINITEPAY_API_KEY;
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(text); } catch { /* resposta não JSON */ }
  if (!res.ok) throw new Error(`InfinitePay ${res.status}: ${text.slice(0, 300)}`);
  return data;
}

/** Cria o link de pagamento. order_nsu = id do nosso Payment. */
export async function createCheckoutLink(input: { paymentId: string; amount: number; description: string; redirectUrl: string; webhookUrl?: string }) {
  const handle = infinitePayHandle();
  if (!handle && !process.env.INFINITEPAY_API_KEY) throw new Error("INFINITEPAY_HANDLE não configurado");
  const data = await call("/links", {
    ...(handle ? { handle } : {}),
    items: [{ quantity: 1, price: input.amount, description: input.description }],
    order_nsu: input.paymentId,
    redirect_url: input.redirectUrl,
    ...(input.webhookUrl ? { webhook_url: input.webhookUrl } : {}),
    // options exige API Key: link de uso único.
    ...(process.env.INFINITEPAY_API_KEY ? { options: { single_payment: true } } : {}),
  });
  const url = [data.url, data.link, data.checkout_url].find((value): value is string => typeof value === "string" && value.startsWith("https://"));
  if (!url) throw new Error(`InfinitePay sem URL na resposta: ${JSON.stringify(data).slice(0, 300)}`);
  return url;
}

/** Fonte da verdade: só considera pago se a InfinitePay confirmar o valor deste pedido. */
export async function checkPayment(input: { paymentId: string; slug: string; transactionNsu: string; amount: number }) {
  const handle = infinitePayHandle();
  const data = await call("/payment_check", {
    ...(handle ? { handle } : {}),
    order_nsu: input.paymentId,
    transaction_nsu: input.transactionNsu,
    slug: input.slug,
  });
  return data.success === true && data.paid === true && Number(data.amount) >= input.amount;
}
