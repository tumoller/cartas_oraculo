"use client";

import React from "react";
import { MessageCircle, Sparkles, ArrowRight } from "lucide-react";
import { ReadingSessionPayload } from "@/types";

interface WhatsAppUpsellProps {
  session: ReadingSessionPayload;
}

export const WhatsAppUpsell: React.FC<WhatsAppUpsellProps> = ({ session }) => {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  if (!number || !/^\d{10,15}$/.test(number)) return null;

  const cardNames = session.cardsDrawn
    .map((c) => c.name || "Carta Oculta")
    .join(", ");

  const message = `Olá! Meu nome é ${session.userName}. Fiz uma leitura sobre "${session.theme}" e saíram estas cartas:\n\n${cardNames}\n\nGostaria de saber se há atendimento ao vivo disponível para conversar sobre minha leitura.`;

  const waUrl = `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(
    message
  )}`;

  return (
    <div className="w-full max-w-3xl mx-auto my-12 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-purple-950/70 via-indigo-950/80 to-purple-950/70 border-2 border-amber-400/50 shadow-2xl cosmic-card-glow-gold relative overflow-hidden animate-fade-in">
      {/* Detalhes luminosos no fundo */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
        <div className="flex-1 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Atendimento sob consulta
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-100 font-serif leading-snug">
            Quer conversar sobre sua leitura?
          </h3>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Peça informações pelo WhatsApp sobre atendimento ao vivo e disponibilidade.
          </p>
        </div>

        <div>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-6 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm sm:text-base tracking-wide transition-all shadow-lg shadow-emerald-900/40 hover:scale-105 cursor-pointer whitespace-nowrap"
          >
            <MessageCircle className="w-5 h-5" />
            Consultar disponibilidade
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};
