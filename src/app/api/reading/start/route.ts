import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { drawDistinctCards } from "@/lib/draw";
import { cardNameForDeck } from "@/lib/card-name";
import { generateOraculoReading } from "@/lib/gemini";
import { generateSpreadReading, SPREADS, SpreadId } from "@/lib/spreads";
import type { ReadingDepth } from "@/lib/spread-config";
import { prisma } from "@/lib/prisma";
import { sanitizeReadingSession } from "@/lib/sanitize";
import { grantReadingAccess, validReadingId } from "@/lib/reading-access";
import type { Card } from "@/types";
import type { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  let draftId: string | undefined;
  let metadata: Record<string, unknown> = {};
  try {
    const { userName, persona, theme, question = "", spread = "line5", readingDepth = "complete", requestId, requestKey, demoAccess = false } = await req.json();
    if (typeof userName !== "string" || !userName.trim() || userName.trim().length > 40 || typeof question !== "string" || question.length > 500) return NextResponse.json({ error: "Informe seu primeiro nome e uma pergunta de até 500 caracteres." }, { status: 400 });
    if (!["Oráculo da Galáxia", "Cigana Tradicional", "Linha de Umbanda"].includes(persona) || !["Amor & Relacionamento", "Trabalho & Dinheiro", "Amizades & Caminhos"].includes(theme) || !Object.hasOwn(SPREADS, spread)) return NextResponse.json({ error: "Escolha uma abordagem, tema e tiragem válidos." }, { status: 400 });
    if (!["basic", "complete"].includes(readingDepth) || (readingDepth === "basic" && spread !== "box9" && spread !== "grand36")) return NextResponse.json({ error: "Escolha uma profundidade válida para esta tiragem." }, { status: 400 });
    if (typeof requestId !== "string" || !validReadingId(requestId) || typeof requestKey !== "string" || !validReadingId(requestKey)) return NextResponse.json({ error: "Identificação da consulta ausente. Reabra o formulário." }, { status: 400 });
    const requestHash = createHash("sha256").update(requestKey).digest("hex");
    let draft = await prisma.readingSession.findUnique({ where: { id: requestId } });
    if (draft) {
      const saved = draft.aiReading as Record<string, unknown>;
      if (saved.requestHash !== requestHash) return NextResponse.json({ error: "Consulta não autorizada." }, { status: 403 });
      if (saved.status === "ready") return grantReadingAccess(NextResponse.json(sanitizeReadingSession(draft)), req, draft.id);
      if (saved.status !== "failed") return NextResponse.json({ error: "Esta consulta já está sendo preparada. Aguarde e tente novamente; as cartas estão preservadas." }, { status: 409 });
      const retry = await prisma.readingSession.updateMany({ where: { id: draft.id, aiReading: { path: ["status"], equals: "failed" } }, data: { aiReading: { ...saved, status: "generating" } as unknown as Prisma.InputJsonValue } });
      if (retry.count !== 1) return NextResponse.json({ error: "Consulta em processamento." }, { status: 409 });
      metadata = { ...saved, status: "generating" };
    } else {
      if (spread !== "line5" && (process.env.ORACLE_DEMO_MODE !== "true" || demoAccess !== true)) return NextResponse.json({ error: "Esta tiragem exige acesso completo. O pagamento ainda está em simulação." }, { status: 403 });
      const deckFolder = persona === "Oráculo da Galáxia" ? "cosmico" : persona === "Linha de Umbanda" ? "umbanda" : "cigano";
      const cards = drawDistinctCards(SPREADS[spread as SpreadId].count).map((card) => {
        const jpg = `/cards/${deckFolder}/card-${card.id}.jpg`;
        const png = `/cards/${deckFolder}/card-${card.id}.png`;
        const imageUrl = existsSync(path.join(process.cwd(), "public", jpg)) ? jpg : png;
        return { ...card, name: cardNameForDeck(card, persona)!, imageUrl: existsSync(path.join(process.cwd(), "public", imageUrl)) ? imageUrl : "" };
      });
      metadata = { requestHash, status: "generating", question: question.trim(), spread, readingDepth, methodVersion: spread === "line5" ? "lenormand-line-v1" : `lenormand-${spread}-v2` };
      draft = await prisma.readingSession.create({ data: { id: requestId, userName: userName.trim(), persona, theme, cardsDrawn: cards as unknown as Prisma.InputJsonValue, aiReading: metadata as unknown as Prisma.InputJsonValue, isPaid: spread !== "line5" } });
    }
    draftId = draft.id;
    // Sorteio persistido antes da IA. Retentativas usam as MESMAS cartas; uma leitura pronta nunca é regerada.
    const cardsDrawn = draft.cardsDrawn as unknown as Card[];
    const savedSpread = metadata.spread as SpreadId;
    const params = { userName: draft.userName, persona: draft.persona, theme: draft.theme, question: metadata.question as string, cardsDrawn };
    const reading = savedSpread === "line5" ? await generateOraculoReading(params) : await generateSpreadReading({ ...params, spread: savedSpread, cards: cardsDrawn, readingDepth: (metadata.readingDepth as ReadingDepth) || "complete" });
    const session = await prisma.readingSession.update({ where: { id: draft.id }, data: { aiReading: { ...metadata, ...reading, status: "ready" } as unknown as Prisma.InputJsonValue } });
    return grantReadingAccess(NextResponse.json(sanitizeReadingSession(session), { status: 201 }), req, session.id);
  } catch (error) {
    const failure = error as { code?: string; name?: string } | null;
    if (draftId) await prisma.readingSession.update({ where: { id: draftId }, data: { aiReading: { ...metadata, status: "failed" } as unknown as Prisma.InputJsonValue } }).catch(() => {});
    console.error("[reading/start]", failure?.code || failure?.name || "Falha de geração");
    return NextResponse.json({ error: failure?.code === "P2002" ? "Consulta já em processamento. Aguarde e tente novamente." : "Não foi possível concluir a interpretação. Tente novamente: as cartas desta consulta permanecem salvas." }, { status: failure?.code === "P2002" ? 409 : 500 });
  }
}
