import {
  AiReading,
  Card,
  PublicAiReading,
  PublicCard,
  ReadingSessionPayload,
} from "@/types";

import { cardNameForDeck } from "./card-name";

interface SessionData {
  id: string;
  userName: string;
  persona: string;
  theme: string;
  cardsDrawn: unknown;
  aiReading: unknown;
  isPaid: boolean;
  createdAt: Date | string;
}

/**
 * Sanitiza rigorosamente a sessão de leitura garantindo que
 * NENHUM DADO BLOQUEADO chegue ao cliente antes do pagamento.
 * Proteção total contra inspeção de código (F12).
 */
export function sanitizeReadingSession(session: SessionData): ReadingSessionPayload {
  const cards = session.cardsDrawn as Card[];
  const ai = session.aiReading as AiReading & { question?: string; methodVersion?: string; spread?: ReadingSessionPayload["spread"]; readingDepth?: ReadingSessionPayload["readingDepth"]; sections?: ReadingSessionPayload["sections"]; cardNotes?: ReadingSessionPayload["cardNotes"] };
  const isPaid = Boolean(session.isPaid);

  let sanitizedCards: PublicCard[];
  let sanitizedAi: PublicAiReading;

  if (isPaid) {
    // Leitura 100% liberada após o pagamento
    sanitizedCards = cards.map((c, idx) => ({
      id: c.id,
      name: cardNameForDeck(c, session.persona),
      keywords: c.keywords,
      polarity: c.polarity,
      meaningLove: c.meaningLove,
      meaningWork: c.meaningWork,
      meaningGeneral: c.meaningGeneral,
      imageUrl: c.imageUrl,
      position: idx + 1,
    }));

    sanitizedAi = {
      card1Reading: ai.card1Reading,
      card2Reading: ai.card2Reading,
      card3Teaser: ai.card3Teaser,
      card3Full: ai.card3Full,
      card4Reading: ai.card4Reading,
      card5Reading: ai.card5Reading,
      generalSynthesis: ai.generalSynthesis,
    };
  } else {
    // Paywall Ativo: Trava total no Back-end
    sanitizedCards = cards.map((c, idx) => {
      const position = idx + 1;
      // Cartas 1, 2 e 3 são reveladas (Carta 3 revela a arte/nome mas com teaser)
      if (position <= 3) {
        return {
          id: c.id,
          name: cardNameForDeck(c, session.persona),
          keywords: c.keywords,
          polarity: c.polarity,
          imageUrl: c.imageUrl,
          position,
        };
      }
      // Cartas 4 e 5: Completamente mascaradas (null) para o cliente
      return {
        id: null,
        name: null,
        keywords: null,
        polarity: null,
        imageUrl: null,
        position,
      };
    });

    sanitizedAi = {
      card1Reading: ai.card1Reading,
      card2Reading: ai.card2Reading,
      card3Teaser: ai.card3Teaser,
      // Campos estritamente bloqueados:
      card3Full: null,
      card4Reading: null,
      card5Reading: null,
      generalSynthesis: null,
    };
  }

  return {
    id: session.id,
    spread: ai.spread || "line5",
    sections: isPaid && ai.readingDepth === "basic" && (ai.spread === "box9" || ai.spread === "grand36")
      ? ai.sections?.filter((section) => /^section[1-4]$/.test(section.id) && Number(section.id.slice(7)) <= (ai.spread === "box9" ? 3 : 4))
      : isPaid ? ai.sections : undefined,
    cardNotes: isPaid ? ai.cardNotes : undefined,
    userName: session.userName,
    question: ai.question,
    methodVersion: ai.methodVersion,
    readingDepth: ai.readingDepth === "basic" ? "basic" : "complete",
    persona: session.persona,
    theme: session.theme,
    cardsDrawn: sanitizedCards,
    aiReading: sanitizedAi,
    isPaid,
    createdAt:
      typeof session.createdAt === "string"
        ? session.createdAt
        : session.createdAt.toISOString(),
  };
}
