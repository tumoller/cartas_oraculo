import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireReadingAccess } from "@/lib/reading-access";
import { audioChapters, audioStatus, chapterJob, enqueueAudio } from "@/lib/audio";
import type { AiReading } from "@/types";

export const runtime = "nodejs";

async function paidReading(request: NextRequest, id: string) {
  if (!requireReadingAccess(request, id)) return null;
  const session = await prisma.readingSession.findUnique({ where: { id }, select: { isPaid: true, persona: true, aiReading: true } });
  return session?.isPaid ? session : null;
}

function itemUrl(id: string, chapter: string) {
  return `/api/reading/${encodeURIComponent(id)}/audio/${chapter}`;
}

async function responseItems(id: string, reading: AiReading, persona: string, chapters: { chapter: string; title: string }[]) {
  return Promise.all(chapters.map(async ({ chapter, title }) => {
    const status = await audioStatus(chapterJob(reading, persona, chapter));
    return { chapter, title, status, ...(status === "ready" ? { url: itemUrl(id, chapter), downloadUrl: `${itemUrl(id, chapter)}?download=1` } : {}) };
  }));
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await paidReading(request, params.id);
  if (!session) return NextResponse.json({ error: "Leitura indisponível." }, { status: 403 });
  const chapter = request.nextUrl.searchParams.get("chapter");
  const reading = session.aiReading as unknown as AiReading;
  const available = audioChapters(reading);
  if (chapter !== null && !available.some((item) => item.chapter === chapter)) return NextResponse.json({ error: "Capítulo inválido." }, { status: 400 });
  const items = await responseItems(params.id, reading, session.persona, chapter ? available.filter((item) => item.chapter === chapter) : available);
  return NextResponse.json(chapter ? items[0] : { chapters: items }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await paidReading(request, params.id);
  if (!session) return NextResponse.json({ error: "Leitura indisponível." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const { chapter, ...rest } = body as Record<string, unknown>;
  const reading = session.aiReading as unknown as AiReading;
  const available = audioChapters(reading);
  if (Object.keys(rest).length || typeof chapter !== "string" || !available.some((item) => item.chapter === chapter)) {
    return NextResponse.json({ error: "Capítulo inválido." }, { status: 400 });
  }
  const chapters = available.filter((item) => item.chapter === chapter);
  try {
    for (const item of chapters) await enqueueAudio(chapterJob(reading, session.persona, item.chapter));
    return NextResponse.json({ chapters: await responseItems(params.id, reading, session.persona, chapters) }, { status: 202, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Falha ao enfileirar áudio:", error);
    return NextResponse.json({ error: "Não foi possível preparar o áudio." }, { status: 500 });
  }
}
