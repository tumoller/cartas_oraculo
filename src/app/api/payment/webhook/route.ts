import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrder, orderStatus, validSignature } from "@/lib/pagbank";
import { markPayment } from "@/lib/payments";

// Aviso do PagBank. O corpo não é confiável por si: o pedido é sempre reconsultado na API com o nosso token.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let orderId: string | undefined;
  try { orderId = (JSON.parse(raw) as { id?: string }).id; } catch { /* formato legado (notificationCode) não é usado aqui */ }
  if (!orderId?.startsWith("ORDE_")) return NextResponse.json({ ignored: true });
  if (!validSignature(raw, req.headers.get("x-authenticity-token"))) console.warn("[payment/webhook] assinatura ausente ou divergente", orderId);
  try {
    const payment = await prisma.payment.findUnique({ where: { orderId } });
    if (!payment) return NextResponse.json({ ignored: true });
    const order = await getOrder(orderId, payment.kind === "test");
    if (order.reference_id !== payment.id) return NextResponse.json({ ignored: true });
    const status = orderStatus(order, payment.amount);
    if (status !== "PENDING") await markPayment(payment, status);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[payment/webhook]", orderId, error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
