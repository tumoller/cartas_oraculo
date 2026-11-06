import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireReadingAccess, validReadingId } from "@/lib/reading-access";
import { productPayload, type ProductMeta } from "@/lib/product-session";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    if (!validReadingId(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    if (!requireReadingAccess(req, id)) return NextResponse.json({ error: "Abra esta leitura no navegador em que ela foi criada." }, { status: 403 });
    const session = await prisma.readingSession.findUnique({ where: { id } });
    const meta = session?.aiReading as unknown as ProductMeta | undefined;
    if (!session || !meta?.product || meta.status !== "ready" || !meta.reading) return NextResponse.json({ error: "Leitura não encontrada." }, { status: 404 });
    return NextResponse.json(productPayload(session), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[api/produto/[id]]", (error as { code?: string })?.code || "erro");
    return NextResponse.json({ error: "Erro ao consultar a leitura." }, { status: 500 });
  }
}
