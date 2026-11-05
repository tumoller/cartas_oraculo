import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pagbankSandbox } from "@/lib/pagbank";
import { markPayment, publicPayment } from "@/lib/payments";
import { validReadingId } from "@/lib/reading-access";

// Só no sandbox: o PagBank não documenta como pagar um Pix de teste, então o resultado é simulado aqui.
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  if (!pagbankSandbox()) return NextResponse.json({ error: "Indisponível." }, { status: 404 });
  const { id } = await props.params;
  const { result } = await req.json().catch(() => ({}));
  if (!validReadingId(id) || (result !== "PAID" && result !== "DECLINED")) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment || payment.kind === "test" || payment.status !== "PENDING") return NextResponse.json({ error: "Pagamento não está pendente." }, { status: 409 });
  return NextResponse.json(publicPayment(await markPayment(payment, result)));
}
