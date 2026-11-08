import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { grantReadingAccess, validReadingId } from "@/lib/reading-access";
import { numerologyProfile, validBirthDate, type NumerologyProfile } from "@/lib/numerology";
import { natalChart, type NatalChart } from "@/lib/natal";
import { findCity, type City } from "@/lib/cities";
import { generateProductReading, productData } from "@/lib/products";
import { productPayload, type ProductMeta } from "@/lib/product-session";
import type { ProductKey } from "@/lib/pricing";
import { CONTACT_NOTICE_VERSION } from "@/lib/contact-notice";

// Sem persona: a coluna do banco é obrigatória, então fica um valor neutro.
const PERSONA = "Neutro";
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
const json = (v: unknown) => v as Prisma.InputJsonValue;

export async function POST(req: NextRequest) {
  let sessionId: string | undefined;
  let meta: ProductMeta | undefined;
  try {
    const body = await req.json();
    const { product, fullName, birthDate, birthTime, city, email, marketing, requestId, requestKey } = body ?? {};
    if (product !== "numerologia" && product !== "mapa") return bad("Produto inválido.");
    if (typeof fullName !== "string") return bad("Informe seu nome completo.");
    const name = fullName.trim().replace(/\s+/g, " ");
    const words = name.split(" ").length;
    if (name.length < 3 || name.length > 80 || (product === "numerologia" && words < 2)) return bad(product === "numerologia" ? "Informe seu nome completo, como na certidão de nascimento." : "Informe seu nome.");
    const m = typeof birthDate === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate) : null;
    const birth = m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null;
    if (!birth || !validBirthDate(birth)) return bad("Informe uma data de nascimento válida.");
    const time = typeof birthTime === "string" && birthTime ? birthTime : "";
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return bad("Hora de nascimento inválida.");
    let cityFound: City | null = null;
    if (product === "mapa") {
      cityFound = city && typeof city.name === "string" && typeof city.uf === "string" ? findCity(city.name, city.uf) : null;
      if (!cityFound) return bad("Escolha a cidade de nascimento na lista.");
      if (typeof email !== "string" || email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return bad("Informe um e-mail válido.");
    }
    if (typeof requestId !== "string" || !validReadingId(requestId) || typeof requestKey !== "string" || !validReadingId(requestKey)) return bad("Identificação ausente. Reabra o formulário.");

    const productKey: ProductKey = product === "numerologia" ? "numerologia" : time ? "mapa-completo" : "mapa-simples";
    const requestHash = createHash("sha256").update(requestKey).digest("hex");
    const firstName = name.split(" ")[0].slice(0, 40);

    let session = await prisma.readingSession.findUnique({ where: { id: requestId } });
    if (session) {
      const saved = session.aiReading as unknown as ProductMeta;
      if (saved.requestHash !== requestHash || !saved.product) return NextResponse.json({ error: "Consulta não autorizada." }, { status: 403 });
      if (saved.status === "ready" && saved.reading) return grantReadingAccess(NextResponse.json(productPayload(session)), req, session.id);
      const startedAt = typeof saved.startedAt === "number" ? saved.startedAt : session.createdAt.getTime();
      const stale = Date.now() - startedAt > 8 * 60_000;
      if (saved.status === "generating" && !stale) return NextResponse.json({ error: "Sua leitura já está sendo preparada. Aguarde." }, { status: 409 });
      meta = { ...saved, status: "generating", startedAt: Date.now() };
      session = await prisma.readingSession.update({ where: { id: session.id }, data: { aiReading: json(meta) } });
    } else {
      let calc: Record<string, unknown>;
      if (product === "numerologia") {
        calc = { numerology: numerologyProfile(name, birth) };
      } else {
        const chart = natalChart({
          date: birth,
          time: time ? { hour: Number(time.slice(0, 2)), minute: Number(time.slice(3)) } : undefined,
          place: { lat: cityFound!.lat, lon: cityFound!.lon, timeZone: cityFound!.timeZone },
        });
        calc = { chart, city: { name: cityFound!.name, uf: cityFound!.uf }, birthTime: time || null };
      }
      meta = { product: productKey, status: "generating", requestHash, startedAt: Date.now() };
      if (product === "mapa") meta.contact = { email: (email as string).trim().toLowerCase(), marketing: marketing === true, consentAt: new Date().toISOString(), notice: CONTACT_NOTICE_VERSION };
      session = await prisma.readingSession.create({
        data: { id: requestId, userName: firstName, persona: PERSONA, theme: product === "numerologia" ? "Numerologia" : "Mapa Astral", cardsDrawn: json(calc), aiReading: json(meta) },
      });
    }
    sessionId = session.id;
    const saved = session.cardsDrawn as unknown as { numerology?: NumerologyProfile; chart?: NatalChart };
    const reading = await generateProductReading(
      meta!.product as ProductKey,
      productData({ firstName: session.userName, numerology: saved.numerology, chart: saved.chart }),
    );
    session = await prisma.readingSession.update({ where: { id: session.id }, data: { aiReading: json({ ...meta, status: "ready", reading }) } });
    return grantReadingAccess(NextResponse.json(productPayload(session), { status: 201 }), req, session.id);
  } catch (error) {
    console.error("[produto/start]", (error as { code?: string; name?: string })?.code || (error as Error)?.name || "falha");
    if (sessionId && meta) await prisma.readingSession.update({ where: { id: sessionId }, data: { aiReading: json({ ...meta, status: "failed" }) } }).catch(() => {});
    return NextResponse.json({ error: "Não foi possível preparar sua leitura agora. Tente de novo em instantes; seus dados estão guardados." }, { status: 500 });
  }
}
