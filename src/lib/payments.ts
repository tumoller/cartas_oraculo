import type { Payment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrder, orderStatus } from "@/lib/pagbank";
import { enqueueAllAudio } from "@/lib/audio";
import type { AiReading } from "@/types";

/** Aplica o resultado: pagamento de "unlock" abre a leitura de 5 cartas; "prepaid" é consumido pelo /reading/start. */
export async function markPayment(payment: Payment, status: "PAID" | "DECLINED" | "EXPIRED") {
  if (payment.status === "PAID" || payment.status === status) return payment;
  const updated = await prisma.payment.update({ where: { id: payment.id }, data: { status, paidAt: status === "PAID" ? new Date() : null } });
  if (status === "PAID" && payment.kind === "unlock") {
    const reading = await prisma.readingSession.update({ where: { id: payment.readingId }, data: { isPaid: true } })
      .catch((error) => { console.error("[payment] unlock falhou", payment.id, error?.code); return null; });
    // Já começa a gerar a voz de todos os capítulos enquanto a pessoa revela as cartas.
    if (reading) await enqueueAllAudio(reading.aiReading as unknown as AiReading, reading.persona);
  }
  return updated;
}

/** Reconsulta o pedido no PagBank e atualiza o pagamento pendente. */
export async function refreshPayment(payment: Payment) {
  if (payment.status !== "PENDING" || !payment.orderId) return payment;
  try {
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
  pixText: payment.status === "PENDING" ? payment.pixText : null,
  pixImage: payment.status === "PENDING" ? payment.pixImage : null,
  expiresAt: payment.expiresAt?.toISOString() ?? null,
});

export type PublicPayment = ReturnType<typeof publicPayment>;
