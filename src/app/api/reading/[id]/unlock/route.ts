import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeReadingSession } from "@/lib/sanitize";
import { requireReadingAccess } from "@/lib/reading-access";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id } = params;
    if (!requireReadingAccess(req, id)) return NextResponse.json({ error: "Acesso à consulta não autorizado." }, { status: 403 });
    if (process.env.ORACLE_DEMO_MODE !== "true") return NextResponse.json({ error: "Simulação indisponível. O pagamento real ainda não foi integrado." }, { status: 403 });

    if (!id) {
      return NextResponse.json({ error: "ID não fornecido." }, { status: 400 });
    }

    const sessionExists = await prisma.readingSession.findUnique({
      where: { id },
    });

    if (!sessionExists) {
      return NextResponse.json(
        { error: "Sessão de leitura não encontrada." },
        { status: 404 }
      );
    }

    // Atualiza o status para Pago no PostgreSQL
    const updatedSession = await prisma.readingSession.update({
      where: { id },
      data: { isPaid: true },
    });

    // Como isPaid agora é true, o sanitizeReadingSession revelará 100% da leitura
    const fullUnlockedPayload = sanitizeReadingSession(updatedSession);

    return NextResponse.json(
      {
        success: true,
        message: "Acesso simulado liberado, sem cobrança.",
        session: fullUnlockedPayload,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API /api/reading/[id]/unlock] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao desbloquear leitura." },
      { status: 500 }
    );
  }
}
