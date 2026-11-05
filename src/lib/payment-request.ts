import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicPayment, type PublicPayment } from "@/lib/payments";
import { PRICES, validCpf, type PricedSpread } from "@/lib/pricing";
import { requireReadingAccess, validReadingId } from "@/lib/reading-access";

export const TITLES: Record<PricedSpread, string> = { line5: "Leitura completa de 5 cartas", box9: "Leitura do Quadro de 9 cartas", grand36: "Mesa Real de 36 cartas" };

type Body = { kind?: unknown; readingId?: unknown; spread?: unknown; name?: unknown; email?: unknown; cpf?: unknown };
export type ValidPayment = { kind: "unlock" | "prepaid"; readingId: string; priced: PricedSpread; amount: number; name: string; email: string; taxId: string; notificationUrl?: string };

/**
 * Valida o pedido de pagamento (Pix ou cartão). Devolve erro, um pagamento já confirmado
 * desta consulta (não cobra duas vezes) ou os dados para cobrar.
 */
export async function validatePaymentRequest(req: NextRequest, body: Body): Promise<{ error: string; status: number } | { paid: PublicPayment } | { ok: ValidPayment }> {
  const { kind, readingId, spread, name, email, cpf } = body;
  if (typeof name !== "string" || !name.trim() || name.length > 80) return { error: "Informe seu nome.", status: 400 };
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return { error: "Informe um e-mail válido.", status: 400 };
  if (typeof cpf !== "string" || !validCpf(cpf)) return { error: "Informe um CPF válido.", status: 400 };
  if (typeof readingId !== "string" || !validReadingId(readingId)) return { error: "Consulta inválida.", status: 400 };

  let priced: PricedSpread;
  if (kind === "unlock") {
    if (!requireReadingAccess(req, readingId)) return { error: "Acesso à consulta não autorizado.", status: 403 };
    const reading = await prisma.readingSession.findUnique({ where: { id: readingId } });
    if (!reading) return { error: "Consulta não encontrada.", status: 404 };
    if (reading.isPaid) return { error: "Esta leitura já está aberta.", status: 409 };
    priced = "line5";
  } else if (kind === "prepaid" && (spread === "box9" || spread === "grand36")) {
    priced = spread;
  } else {
    return { error: "Pagamento inválido.", status: 400 };
  }

  // Já pago (ex.: a IA falhou e a pessoa tenta de novo): devolve o pagamento confirmado.
  const paid = await prisma.payment.findFirst({ where: { readingId, kind, spread: priced, status: "PAID" } });
  if (paid) return { paid: publicPayment(paid) };
  if (kind === "prepaid" && await prisma.readingSession.findUnique({ where: { id: readingId } })) return { error: "Esta consulta já foi iniciada.", status: 409 };

  const origin = process.env.PUBLIC_BASE_URL || req.nextUrl.origin;
  return {
    ok: {
      kind, readingId, priced, amount: PRICES[priced],
      name: name.trim(), email: email.trim(), taxId: cpf.replace(/\D/g, ""),
      notificationUrl: origin.startsWith("https://") ? `${origin}/api/payment/webhook` : undefined,
    },
  };
}
