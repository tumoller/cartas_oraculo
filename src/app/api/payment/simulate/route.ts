import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markPayment, publicPayment } from "@/lib/payments";
import { validatePaymentRequest } from "@/lib/payment-request";
import { startPaidPart } from "@/lib/paid-part";

// SÓ NO `npm run dev`: registra um pagamento como pago sem passar pela InfinitePay, para testar o que abre
// depois do pagamento. Em produção (next build/start) responde 404. Fica marcado como "simulado-" no orderId.
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") return NextResponse.json({ error: "Indisponível." }, { status: 404 });
  const checked = await validatePaymentRequest(req, await req.json().catch(() => ({})), false);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: checked.status });
  if ("paid" in checked) return NextResponse.json(checked.paid);
  const p = checked.ok;
  if (p.kind === "unlock") startPaidPart(p.readingId);
  const id = randomUUID();
  const payment = await prisma.payment.create({ data: { id, readingId: p.readingId, kind: p.kind, spread: p.priced, amount: p.amount, orderId: `simulado-${id}` } });
  return NextResponse.json(publicPayment(await markPayment(payment, "PAID")), { status: 201 });
}
