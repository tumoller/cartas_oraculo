// Segunda etapa da leitura (a parte paga). A primeira etapa é escrita na hora; esta só quando a pessoa
// abre o pagamento (o checkout leva tempo, então quase sempre já está pronta quando ela volta) ou,
// se ainda não existir, quando o pagamento é confirmado. Assim a IA não escreve à toa para quem só fica no grátis.
import { after } from "next/server";
import type { Prisma, ReadingSession } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generatePaidReading, PAID_KEYS, type FreeReading } from "@/lib/gemini";
import { generateProductReading, paidSectionsReady, productData, type ProductReading } from "@/lib/products";
import { enqueueAllAudio } from "@/lib/audio";
import type { ProductKey } from "@/lib/pricing";
import type { NumerologyProfile } from "@/lib/numerology";
import type { NatalChart } from "@/lib/natal";
import type { AiReading, Card } from "@/types";

export type PaidState = "none" | "generating" | "ready" | "failed";
type Meta = Record<string, unknown> & { paid?: PaidState; paidStartedAt?: number };

const STALE_MS = 4 * 60_000;
const json = (v: unknown) => v as Prisma.InputJsonValue;

/** Só a linha de 5 cartas e os produtos (mapa, numerologia) têm a segunda etapa; 9 e 36 são pagas antes e escritas inteiras. */
function hasPaidPart(meta: Meta) {
  return typeof meta.product === "string" || (meta.spread ?? "line5") === "line5";
}

export function paidPartReady(session: Pick<ReadingSession, "aiReading">) {
  const meta = session.aiReading as Meta;
  if (!hasPaidPart(meta)) return true;
  if (typeof meta.product === "string") return paidSectionsReady(meta.reading as ProductReading | undefined);
  return PAID_KEYS.every((key) => typeof meta[key] === "string" && (meta[key] as string).trim());
}

/** Reserva a geração (só um processo escreve por vez; "gerando" parado há mais de 4 min pode ser retomado). */
async function claim(session: ReadingSession): Promise<Meta | null> {
  const meta = session.aiReading as Meta;
  const state = meta.paid;
  if (state === "ready") return null;
  if (state === "generating" && typeof meta.paidStartedAt === "number" && Date.now() - meta.paidStartedAt < STALE_MS) return null;
  const where: Prisma.ReadingSessionWhereInput = state === "generating"
    ? { id: session.id, AND: [{ aiReading: { path: ["paid"], equals: "generating" } }, { aiReading: { path: ["paidStartedAt"], equals: meta.paidStartedAt ?? 0 } }] }
    : state ? { id: session.id, aiReading: { path: ["paid"], equals: state } } : { id: session.id };
  const next: Meta = { ...meta, paid: "generating", paidStartedAt: Date.now() };
  const won = await prisma.readingSession.updateMany({ where, data: { aiReading: json(next) } });
  return won.count === 1 ? next : null;
}

async function write(id: string, patch: (meta: Meta) => Meta) {
  const fresh = await prisma.readingSession.findUnique({ where: { id } });
  if (!fresh) return null;
  return prisma.readingSession.update({ where: { id }, data: { aiReading: json(patch(fresh.aiReading as Meta)) } });
}

async function run(id: string) {
  const session = await prisma.readingSession.findUnique({ where: { id } });
  if (!session || paidPartReady(session)) return;
  const meta = await claim(session);
  if (!meta) return;
  try {
    if (typeof meta.product === "string") {
      const calc = session.cardsDrawn as unknown as { numerology?: NumerologyProfile; chart?: NatalChart };
      const reading = await generateProductReading(meta.product as ProductKey, productData({ firstName: session.userName, numerology: calc.numerology, chart: calc.chart }), "paid", meta.reading as ProductReading);
      await write(id, (m) => ({ ...m, reading, paid: "ready" }));
    } else {
      const texts = meta as unknown as FreeReading;
      const paid = await generatePaidReading(
        { userName: session.userName, persona: session.persona, theme: session.theme, question: meta.question as string | undefined, cardsDrawn: session.cardsDrawn as unknown as Card[] },
        { card1Reading: texts.card1Reading, card2Reading: texts.card2Reading, card3Teaser: texts.card3Teaser },
      );
      const saved = await write(id, (m) => ({ ...m, ...paid, paid: "ready" }));
      // Se o pagamento já tinha sido confirmado, a voz começa agora (o markPayment pulou por falta do texto).
      if (saved?.isPaid) await enqueueAllAudio(saved.aiReading as unknown as AiReading, saved.persona);
    }
  } catch (error) {
    console.error("[paid-part]", id, error instanceof Error ? error.message : error);
    await write(id, (m) => ({ ...m, paid: "failed" })).catch(() => {});
  }
}

/** Dispara a segunda etapa depois da resposta (não segura a requisição). Seguro chamar várias vezes. */
export function startPaidPart(id: string) {
  const job = () => run(id).catch((error) => console.error("[paid-part] falhou", id, error instanceof Error ? error.message : error));
  try { after(job); } catch { void job(); } // fora de uma requisição (ex.: testes), roda direto
}

/** Espera a segunda etapa ficar pronta por até `ms`; devolve a sessão mais recente (pronta ou não). */
export async function waitPaidPart(id: string, ms: number): Promise<ReadingSession | null> {
  const until = Date.now() + ms;
  let session = await prisma.readingSession.findUnique({ where: { id } });
  while (session && !paidPartReady(session) && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    session = await prisma.readingSession.findUnique({ where: { id } });
  }
  return session;
}
