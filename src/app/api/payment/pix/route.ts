import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPixOrder, pagbankEnabled } from "@/lib/pagbank";
import { publicPayment } from "@/lib/payments";
import { TITLES, validatePaymentRequest } from "@/lib/payment-request";

const PIX_MINUTES = 30;

export async function POST(req: NextRequest) {
  if (!pagbankEnabled()) return NextResponse.json({ error: "Indisponível." }, { status: 404 });
  try {
    const checked = await validatePaymentRequest(req, await req.json());
    if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: checked.status });
    if ("paid" in checked) return NextResponse.json(checked.paid);
    const p = checked.ok;

    // Reaproveita um Pix ainda válido da mesma consulta (evita QR duplicado a cada toque).
    const open = await prisma.payment.findFirst({ where: { readingId: p.readingId, kind: p.kind, spread: p.priced, status: "PENDING", pixText: { not: null }, expiresAt: { gt: new Date(Date.now() + 2 * 60_000) } }, orderBy: { createdAt: "desc" } });
    if (open) return NextResponse.json(publicPayment(open));

    const id = randomUUID();
    const expiresAt = new Date(Date.now() + PIX_MINUTES * 60_000);
    const pix = await createPixOrder({ referenceId: id, amount: p.amount, itemName: TITLES[p.priced], name: p.name, email: p.email, taxId: p.taxId, notificationUrl: p.notificationUrl, expiresAt });
    const payment = await prisma.payment.create({ data: { id, readingId: p.readingId, kind: p.kind, spread: p.priced, amount: p.amount, orderId: pix.orderId, pixText: pix.pixText, pixImage: pix.pixImage, expiresAt } });
    return NextResponse.json(publicPayment(payment), { status: 201 });
  } catch (error) {
    console.error("[payment/pix]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível gerar o Pix agora. Tente de novo em instantes." }, { status: 502 });
  }
}
