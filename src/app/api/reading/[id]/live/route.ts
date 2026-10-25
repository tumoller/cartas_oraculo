import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireReadingAccess } from "@/lib/reading-access";
import { createLiveToken, liveInstruction, liveTrialStarted, releaseFailedLiveTrial, reserveLiveTrial } from "@/lib/live";

export const runtime = "nodejs";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!requireReadingAccess(req, params.id)) {
    return NextResponse.json({ error: "Acesso à leitura negado." }, { status: 403 });
  }
  if (process.env.ORACLE_LIVE_ENABLED !== "true") {
    return NextResponse.json({ enabled: false });
  }
  const session = await prisma.readingSession.findUnique({ where: { id: params.id }, select: { isPaid: true } });
  if (!session?.isPaid || !process.env.GEMINI_API_KEY) {
    return NextResponse.json({ enabled: false });
  }
  return NextResponse.json(
    { enabled: true, started: await liveTrialStarted(params.id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (process.env.ORACLE_LIVE_ENABLED !== "true") {
    return NextResponse.json({ error: "Conversa ao vivo indisponível." }, { status: 404 });
  }
  if (!requireReadingAccess(req, params.id)) {
    return NextResponse.json({ error: "Acesso à leitura negado." }, { status: 403 });
  }
  if (!/^[a-f\d-]{36}$/i.test(params.id)) {
    return NextResponse.json({ error: "Leitura inválida." }, { status: 400 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Conversa ao vivo não configurada." }, { status: 503 });
  }

  const session = await prisma.readingSession.findUnique({ where: { id: params.id } });
  if (!session || !session.isPaid) {
    return NextResponse.json({ error: "Leitura completa indisponível." }, { status: 403 });
  }

  let reservation: Awaited<ReturnType<typeof reserveLiveTrial>>;
  try {
    reservation = await reserveLiveTrial(params.id);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return NextResponse.json({ error: "O teste desta leitura já foi iniciado." }, { status: 409 });
    }
    console.error("[Live] Falha ao reservar teste:", error);
    return NextResponse.json({ error: "Não foi possível iniciar o teste." }, { status: 500 });
  }

  try {
    const token = await createLiveToken(apiKey, liveInstruction(session), reservation.expiresAt);
    return NextResponse.json(
      { token, model: "gemini-3.8-live", expiresAt: reservation.expiresAt },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    await releaseFailedLiveTrial(reservation.marker);
    console.error("[Live] Falha ao criar token efêmero:", error);
    return NextResponse.json({ error: "Não foi possível conectar ao serviço ao vivo." }, { status: 502 });
  }
}
