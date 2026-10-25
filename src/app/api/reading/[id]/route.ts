import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeReadingSession } from "@/lib/sanitize";
import { requireReadingAccess } from "@/lib/reading-access";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!requireReadingAccess(req, id)) return NextResponse.json({ error: "Abra esta consulta no navegador em que ela foi criada." }, { status: 403 });

    if (!id) {
      return NextResponse.json({ error: "ID não fornecido." }, { status: 400 });
    }

    const session = await prisma.readingSession.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Sessão de leitura não encontrada." },
        { status: 404 }
      );
    }
    if ((session.aiReading as Record<string, unknown>).status && (session.aiReading as Record<string, unknown>).status !== "ready") return NextResponse.json({ error: "A interpretação ainda não foi concluída." }, { status: 409 });

    const sanitized = sanitizeReadingSession(session);
    return NextResponse.json(sanitized, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("[API /api/reading/[id]] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao consultar leitura." },
      { status: 500 }
    );
  }
}
