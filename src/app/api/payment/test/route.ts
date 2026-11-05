import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPixOrder } from "@/lib/pagbank";
import { publicPayment, refreshPayment } from "@/lib/payments";
import { validCpf } from "@/lib/pricing";
import { validReadingId } from "@/lib/reading-access";

// Pix REAL de valor baixo, em produção (PAGBANK_PROD_TOKEN), para validar a cobrança e o webhook
// com o site ainda em sandbox. Protegido por PAGBANK_TEST_KEY; não libera nenhuma leitura.
function allowed(key: unknown) {
  const expected = process.env.PAGBANK_TEST_KEY;
  if (!expected || typeof key !== "string" || key.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(key), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  try {
    const { key, cents, name, email, cpf } = await req.json();
    if (!allowed(key)) return NextResponse.json({ error: "Chave de teste inválida." }, { status: 403 });
    if (!Number.isInteger(cents) || cents < 1 || cents > 1000) return NextResponse.json({ error: "Valor entre R$ 0,01 e R$ 10,00." }, { status: 400 });
    if (typeof name !== "string" || !name.trim() || typeof email !== "string" || !email.includes("@") || typeof cpf !== "string" || !validCpf(cpf)) return NextResponse.json({ error: "Confira nome, e-mail e CPF." }, { status: 400 });
    const origin = process.env.PUBLIC_BASE_URL || req.nextUrl.origin;
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60_000);
    const pix = await createPixOrder({
      referenceId: id, amount: cents, itemName: "Teste de pagamento", name: name.trim(), email: email.trim(), taxId: cpf.replace(/\D/g, ""),
      notificationUrl: origin.startsWith("https://") ? `${origin}/api/payment/webhook` : undefined, expiresAt, prod: true,
    });
    const payment = await prisma.payment.create({ data: { id, readingId: randomUUID(), kind: "test", spread: "test", amount: cents, orderId: pix.orderId, pixText: pix.pixText, pixImage: pix.pixImage, expiresAt } });
    return NextResponse.json({ ...publicPayment(payment), webhook: Boolean(origin.startsWith("https://")) }, { status: 201 });
  } catch (error) {
    console.error("[payment/test]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao gerar o Pix." }, { status: 502 });
  }
}

/** Status salvo no banco (só o webhook muda); com refresh=1, reconsulta o PagBank. */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!allowed(key)) return NextResponse.json({ error: "Chave de teste inválida." }, { status: 403 });
  if (!validReadingId(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  let payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment || payment.kind !== "test") return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  if (req.nextUrl.searchParams.get("refresh") === "1") payment = await refreshPayment(payment);
  return NextResponse.json(publicPayment(payment), { headers: { "Cache-Control": "no-store" } });
}
