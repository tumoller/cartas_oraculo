import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicPayment, refreshPayment } from "@/lib/payments";
import { validReadingId } from "@/lib/reading-access";

// O id do pagamento (UUID aleatório) só é conhecido por quem gerou o Pix.
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!validReadingId(id)) return NextResponse.json({ error: "Pagamento inválido." }, { status: 400 });
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
  return NextResponse.json(publicPayment(await refreshPayment(payment)), { headers: { "Cache-Control": "no-store" } });
}
