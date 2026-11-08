import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeReadingSession } from "@/lib/sanitize";
import { requireReadingAccess } from "@/lib/reading-access";
import { paidPartReady, startPaidPart, waitPaidPart } from "@/lib/paid-part";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id } = params;
    if (!requireReadingAccess(req, id)) return NextResponse.json({ error: "Abra esta consulta no navegador em que ela foi criada." }, { status: 403 });

    if (!id) {
      return NextResponse.json({ error: "ID não fornecido." }, { status: 400 });
    }

    let session = await prisma.readingSession.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Sessão de leitura não encontrada." },
        { status: 404 }
      );
    }
    if ((session.aiReading as Record<string, unknown>).status && (session.aiReading as Record<string, unknown>).status !== "ready") return NextResponse.json({ error: "A interpretação ainda não foi concluída." }, { status: 409 });

    // Pago, mas a parte paga ainda está sendo escrita: dispara (se preciso), espera até 25 s e, se não ficar
    // pronta, responde 202 para o navegador perguntar de novo.
    if (session.isPaid && !paidPartReady(session)) {
      startPaidPart(session.id);
      const latest = await waitPaidPart(session.id, 25_000);
      if (!latest || !paidPartReady(latest)) return NextResponse.json({ pending: true }, { status: 202, headers: { "Cache-Control": "private, no-store" } });
      session = latest;
    }
    const sanitized = sanitizeReadingSession(session);
    return NextResponse.json(sanitized, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[API /api/reading/[id]] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao consultar leitura." },
      { status: 500 }
    );
  }
}
