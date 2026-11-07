import type { ReadingSession } from "@prisma/client";
import type { ProductReading } from "@/lib/products";
import { sanitizeProductReading } from "@/lib/products";

export type ProductMeta = {
  product: string;
  status: "generating" | "ready" | "failed";
  requestHash: string;
  startedAt: number;
  reading?: ProductReading;
  // Mapa astral: e-mail exigido para ver o mapa grátis. Fica só no servidor (não vai no payload).
  contact?: { email: string; marketing: boolean; consentAt: string; notice: string };
};

export function productPayload(session: ReadingSession) {
  const meta = session.aiReading as unknown as ProductMeta;
  return {
    id: session.id,
    product: meta.product,
    isPaid: session.isPaid,
    firstName: session.userName,
    persona: session.persona,
    calc: session.cardsDrawn,
    reading: sanitizeProductReading(meta.reading as ProductReading, session.isPaid),
  };
}
