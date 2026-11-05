import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmCheckout } from "@/lib/payments";
import { validReadingId } from "@/lib/reading-access";

// A InfinitePay devolve o cliente para cá com slug e transaction_nsu na URL.
// Os parâmetros vêm do navegador: só servem para consultar o /payment_check, nunca como prova.
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const origin = process.env.PUBLIC_BASE_URL || req.nextUrl.origin;
  if (!validReadingId(id)) return NextResponse.redirect(`${origin}/`, 303);
  const slug = req.nextUrl.searchParams.get("slug");
  const transactionNsu = req.nextUrl.searchParams.get("transaction_nsu");
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (payment && slug && transactionNsu) {
    await confirmCheckout(payment, slug, transactionNsu)
      .catch((error) => console.error("[payment/return]", id, error instanceof Error ? error.message : error));
  }
  return NextResponse.redirect(`${origin}/pagamento-concluido?id=${id}`, 303);
}
