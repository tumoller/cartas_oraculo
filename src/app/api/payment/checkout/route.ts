import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCheckoutLink } from "@/lib/infinitepay";
import { publicPayment } from "@/lib/payments";
import { TITLES, validatePaymentRequest } from "@/lib/payment-request";

/** Cria (ou reaproveita) o link de pagamento da InfinitePay para esta consulta. */
export async function POST(req: NextRequest) {
  try {
    const checked = await validatePaymentRequest(req, await req.json(), false);
    if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: checked.status });
    if ("paid" in checked) return NextResponse.json(checked.paid);
    const p = checked.ok;

    // Mesmo link a cada toque: a pessoa pode ter voltado sem pagar.
    const open = await prisma.payment.findFirst({ where: { readingId: p.readingId, kind: p.kind, spread: p.priced, status: "PENDING", pixImage: null, pixText: { startsWith: "https://" } }, orderBy: { createdAt: "desc" } });
    if (open) return NextResponse.json(publicPayment(open));

    const origin = process.env.PUBLIC_BASE_URL || req.nextUrl.origin;
    const id = randomUUID();
    const url = await createCheckoutLink({
      paymentId: id,
      amount: p.amount,
      description: `Cartas Oráculo · ${TITLES[p.priced]}`,
      redirectUrl: `${origin}/api/payment/return/${id}`,
      webhookUrl: origin.startsWith("https://") ? `${origin}/api/payment/infinitepay` : undefined,
    });
    const payment = await prisma.payment.create({ data: { id, readingId: p.readingId, kind: p.kind, spread: p.priced, amount: p.amount, pixText: url } });
    return NextResponse.json(publicPayment(payment), { status: 201 });
  } catch (error) {
    console.error("[payment/checkout]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível abrir o pagamento agora. Tente de novo em instantes." }, { status: 502 });
  }
}
