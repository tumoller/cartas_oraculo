import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireReadingAccess } from "@/lib/reading-access";
import { sanitizeReadingSession } from "@/lib/sanitize";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireReadingAccess(req, params.id)) return NextResponse.json({error:"Acesso não autorizado."},{status:403});
  const session = await prisma.readingSession.findUnique({where:{id:params.id}});
  if (!session?.isPaid) return NextResponse.json({error:"A consulta completa ainda não foi liberada."},{status:403});
  const reading = sanitizeReadingSession(session);
  const chapters = reading.sections?.map((section) => `${section.title}\n${section.text}`) || [reading.aiReading.card1Reading,reading.aiReading.card2Reading,[reading.aiReading.card3Teaser,reading.aiReading.card3Full].join("\n"),reading.aiReading.card4Reading,reading.aiReading.card5Reading];
  const text = [`Consulta de ${reading.userName}`,reading.persona,reading.theme,reading.question ? `Pergunta: ${reading.question}` : "",`Realizada em ${reading.createdAt}`,"Mesa original:",...reading.cardsDrawn.map((card) => `Posição ${card.position}: ${card.name}`),...chapters,"Síntese geral",reading.aiReading.generalSynthesis].filter(Boolean).join("\n\n");
  return new NextResponse(text,{headers:{"Content-Type":"text/plain; charset=utf-8","Content-Disposition":`attachment; filename="consulta-${session.id}.txt"`,"Cache-Control":"private, no-store"}});
}
