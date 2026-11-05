"use client";

import React from "react";
import { MessageCircle } from "lucide-react";
import { ReadingSessionPayload } from "@/types";

interface WhatsAppUpsellProps {
  session: ReadingSessionPayload;
}

/** Convite compacto para atendimento ao vivo, dentro do menu da consulta. */
export const WhatsAppUpsell: React.FC<WhatsAppUpsellProps> = ({ session }) => {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  if (!number || !/^\d{10,15}$/.test(number)) return null;

  const cardNames = session.cardsDrawn.map((c) => c.name || "Carta Oculta").join(", ");
  const message = `Olá! Meu nome é ${session.userName}. Fiz uma leitura sobre "${session.theme}" e saíram estas cartas:\n\n${cardNames}\n\nGostaria de saber se há atendimento ao vivo disponível para conversar sobre minha leitura.`;
  const waUrl = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

  return (
    <div className="mb-3 rounded-2xl border border-amber-400/30 bg-black/25 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Atendimento sob consulta</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-300">Quer conversar com uma pessoa sobre a sua leitura? Peça disponibilidade pelo WhatsApp.</p>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500"
      >
        <MessageCircle className="h-4 w-4" /> Consultar disponibilidade
      </a>
    </div>
  );
};
