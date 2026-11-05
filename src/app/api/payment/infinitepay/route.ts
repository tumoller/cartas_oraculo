import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmCheckout } from "@/lib/payments";
import { validReadingId } from "@/lib/reading-access";

// Webhook da InfinitePay. Não tem assinatura: o aviso só vale depois de confirmado no /payment_check.
// 200 = processado (ou nada a fazer); 400 = falhou e a InfinitePay reenvia.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const { order_nsu: orderNsu, invoice_slug: slug, transaction_nsu: transactionNsu } = body;
  if (typeof orderNsu !== "string" || !validReadingId(orderNsu)) return NextResponse.json({ ok: true });
  const payment = await prisma.payment.findUnique({ where: { id: orderNsu } });
  if (!payment || payment.status !== "PENDING") return NextResponse.json({ ok: true });
  if (typeof slug !== "string" || typeof transactionNsu !== "string") return NextResponse.json({ ok: true });
  try {
    const updated = await confirmCheckout(payment, slug, transactionNsu);
    if (updated.status !== "PAID") console.warn("[payment/infinitepay] aviso não confirmado", payment.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[payment/infinitepay]", payment.id, error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "falha ao confirmar" }, { status: 400 });
  }
}
