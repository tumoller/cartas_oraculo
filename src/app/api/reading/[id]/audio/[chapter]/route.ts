import { promises as fs } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireReadingAccess } from "@/lib/reading-access";
import { audioChapters, audioPaths, chapterJob } from "@/lib/audio";
import type { AiReading } from "@/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: { id: string; chapter: string } }) {
  const { id, chapter } = params;
  if (!requireReadingAccess(request, id)) {
    return NextResponse.json({ error: "Áudio indisponível." }, { status: 403 });
  }
  const session = await prisma.readingSession.findUnique({ where: { id }, select: { isPaid: true, persona: true, aiReading: true } });
  if (!session?.isPaid) return NextResponse.json({ error: "Áudio indisponível." }, { status: 403 });
  const reading = session.aiReading as unknown as AiReading;
  const saved = reading as AiReading & { spread?: string; sections?: { text: string }[] };
  const legacyCard = /^(card[1-5])$/.test(chapter) && (saved.spread === "line5" || !Array.isArray(saved.sections));
  const section = /^section([1-9]\d*)$/.exec(chapter);
  const legacySection = section && Array.isArray(saved.sections) && typeof saved.sections[Number(section[1]) - 1]?.text === "string";
  if (!audioChapters(reading).some((item) => item.chapter === chapter) && !legacyCard && !legacySection) return NextResponse.json({ error: "Áudio indisponível." }, { status: 404 });
  const file = audioPaths(chapterJob(reading, session.persona, chapter).key).file;
  let size: number;
  try { size = (await fs.stat(file)).size; } catch { return NextResponse.json({ error: "Áudio ainda não disponível." }, { status: 404 }); }
  if (size <= 44) return NextResponse.json({ error: "Áudio ainda não disponível." }, { status: 404 });

  const range = request.headers.get("range");
  let start = 0;
  let end = size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    if (!match[1]) start = Math.max(0, size - Number(match[2]));
    else start = Number(match[1]);
    if (match[1] && match[2]) end = Math.min(end, Number(match[2]));
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
  }
  const bytes = (await fs.readFile(file)).subarray(start, end + 1);
  const headers: Record<string, string> = {
    "Content-Type": "audio/wav",
    "Content-Length": String(bytes.length),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Disposition": `${request.nextUrl.searchParams.has("download") ? "attachment" : "inline"}; filename=leitura-${chapter}.wav`,
  };
  if (range) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  return new NextResponse(bytes, { status: range ? 206 : 200, headers });
}
