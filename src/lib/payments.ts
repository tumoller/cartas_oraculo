import type { Payment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrder, orderStatus } from "@/lib/pagbank";
import { enqueueAllAudio } from "@/lib/audio";
import { checkPayment, infinitePayRef, parseInfinitePayRef } from "@/lib/infinitepay";
import type { AiReading } from "@/types";
import { paidPartReady, startPaidPart } from "@/lib/paid-part";

/** Aplica o resultado: pagamento de "unlock" abre a leitura de 5 cartas; "prepaid" é consumido pelo /reading/start. */
export async function markPayment(payment: Payment, status: "PAID" | "DECLINED" | "EXPIRED") {
  if (payment.status === "PAID" || payment.status === status) return payment;
  const updated = await prisma.payment.update({ where: { id: payment.id }, data: { status, paidAt: status === "PAID" ? new Date() : null } });
  if (status === "PAID" && payment.kind === "unlock") {
    const reading = await prisma.readingSession.update({ where: { id: payment.readingId }, data: { isPaid: true } })
      .catch((error) => { console.error("[payment] unlock falhou", payment.id, error?.code); return null; });
    // Parte paga ainda não escrita: começa agora (a voz é preparada quando ela terminar).
    if (reading && !paidPartReady(reading)) startPaidPart(reading.id);
    // Já começa a gerar a voz de todos os capítulos enquanto a pessoa revela as cartas.
    // Numerologia e mapa (aiReading.product) ainda não têm voz na V1.
    else if (reading && !(reading.aiReading as { product?: unknown } | null)?.product) await enqueueAllAudio(reading.aiReading as unknown as AiReading, reading.persona);
  }
  return updated;
}

/** Pagamento pela InfinitePay: o link fica em pixText, sem QR (pixImage). */
export const isCheckoutPayment = (payment: Payment) => !payment.pixImage && Boolean(payment.pixText?.startsWith("https://"));

/**
 * Guarda a transação informada pela InfinitePay (retorno ou webhook) e confirma no /payment_check.
 * A referência só é gravada se a InfinitePay confirmar que esta transação pagou este pedido.
 */
export async function confirmCheckout(payment: Payment, slug: string, transactionNsu: string) {
  if (payment.status !== "PENDING" || !isCheckoutPayment(payment)) return payment;
  if (!/^[\w-]{1,120}$/.test(slug) || !/^[\w-]{1,120}$/.test(transactionNsu)) return payment;
  if (!await checkPayment({ paymentId: payment.id, slug, transactionNsu, amount: payment.amount })) return payment;
  const updated = await prisma.payment.update({ where: { id: payment.id }, data: { orderId: infinitePayRef(slug, transactionNsu) } })
    .catch((error) => { console.error("[payment] referência InfinitePay repetida", payment.id, error?.code); return null; });
  return updated ? markPayment(updated, "PAID") : payment;
}

/** Reconsulta o pedido (PagBank ou InfinitePay) e atualiza o pagamento pendente. */
export async function refreshPayment(payment: Payment) {
  if (payment.status !== "PENDING" || !payment.orderId) return payment;
  try {
    const ref = parseInfinitePayRef(payment.orderId);
    if (ref) {
      if (await checkPayment({ paymentId: payment.id, ...ref, amount: payment.amount })) return markPayment(payment, "PAID");
      return payment;
    }
    const status = orderStatus(await getOrder(payment.orderId, payment.kind === "test"), payment.amount);
    if (status !== "PENDING") return markPayment(payment, status);
  } catch (error) {
    console.error("[payment] consulta falhou", payment.id, error instanceof Error ? error.message : error);
  }
  if (payment.expiresAt && payment.expiresAt.getTime() < Date.now()) return markPayment(payment, "EXPIRED");
  return payment;
}

export const publicPayment = (payment: Payment) => ({
  id: payment.id,
  kind: payment.kind,
  spread: payment.spread,
  readingId: payment.readingId,
  amount: payment.amount,
  status: payment.status,
  pixText: payment.status === "PENDING" && !isCheckoutPayment(payment) ? payment.pixText : null,
  pixImage: payment.status === "PENDING" ? payment.pixImage : null,
  checkoutUrl: payment.status === "PENDING" && isCheckoutPayment(payment) ? payment.pixText : null,
  expiresAt: payment.expiresAt?.toISOString() ?? null,
});

export type PublicPayment = ReturnType<typeof publicPayment>;
