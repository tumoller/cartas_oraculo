import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCardOrder, getCardPublicKey, pagbankEnabled } from "@/lib/pagbank";
import { markPayment, publicPayment } from "@/lib/payments";
import { TITLES, validatePaymentRequest } from "@/lib/payment-request";

/** Chave pública para o navegador criptografar o cartão. */
export async function GET() {
  try {
    return NextResponse.json({ publicKey: await getCardPublicKey() }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (error) {
    console.error("[payment/card key]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Cartão indisponível agora. Use o Pix." }, { status: 502 });
  }
}

/** Cobrança no cartão (1x). Recebe só o cartão criptografado no navegador; o resultado é imediato. */
export async function POST(req: NextRequest) {
  if (!pagbankEnabled()) return NextResponse.json({ error: "Indisponível." }, { status: 404 });
  try {
    const body = await req.json();
    const { encrypted, holderName } = body;
    if (typeof encrypted !== "string" || encrypted.length < 100 || encrypted.length > 2000) return NextResponse.json({ error: "Confira os dados do cartão." }, { status: 400 });
    if (typeof holderName !== "string" || !holderName.trim() || holderName.length > 80) return NextResponse.json({ error: "Informe o nome impresso no cartão." }, { status: 400 });
    const checked = await validatePaymentRequest(req, body);
    if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: checked.status });
    if ("paid" in checked) return NextResponse.json(checked.paid);
    const p = checked.ok;

    const id = randomUUID();
    const card = await createCardOrder({ referenceId: id, amount: p.amount, itemName: TITLES[p.priced], name: p.name, email: p.email, taxId: p.taxId, encrypted, holderName: holderName.trim(), notificationUrl: p.notificationUrl });
    let payment = await prisma.payment.create({ data: { id, readingId: p.readingId, kind: p.kind, spread: p.priced, amount: p.amount, orderId: card.orderId } });
    if (card.status !== "PENDING") payment = await markPayment(payment, card.status);
    return NextResponse.json({ ...publicPayment(payment), message: card.status === "DECLINED" ? card.message : null }, { status: 201 });
  } catch (error) {
    console.error("[payment/card]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível processar o cartão agora. Tente o Pix." }, { status: 502 });
  }
}
