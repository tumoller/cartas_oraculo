"use client";

import React, { useEffect, useRef, useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { PublicCard } from "@/types";

interface CardItemProps {
  card: PublicCard;
  isFlipped: boolean;
  isLocked: boolean;
  onCardClick?: () => void;
  positionLabel: string;
  compact?: "single" | "pair" | "detail";
  actionLabel?: string;
  deck?: string;
  buttonId?: string;
}

export const CardItem: React.FC<CardItemProps> = ({
  card,
  isFlipped,
  isLocked,
  onCardClick,
  positionLabel,
  compact,
  actionLabel,
  deck,
  buttonId,
}) => {
  const [imgError, setImgError] = useState(false);
  const [justRevealed, setJustRevealed] = useState(false);
  const previousFlip = useRef(isFlipped);
  useEffect(() => {
    if (isFlipped && !previousFlip.current) setJustRevealed(true);
    previousFlip.current = isFlipped;
  }, [isFlipped]);
  const showFace = isFlipped && !isLocked;
  const backStyle = deck === "Linha de Umbanda"
    ? "border-emerald-500/60 bg-linear-to-b from-emerald-950 via-slate-900 to-slate-950"
    : deck === "Cigana Tradicional"
      ? "border-amber-500/60 bg-linear-to-b from-rose-950 via-amber-950 to-slate-950"
      : "border-cyan-500/50 bg-linear-to-b from-indigo-950 via-purple-950 to-slate-950";

  return (
    <div className="flex flex-col items-center group">
      {/* Rótulo da Posição */}
      <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-1">
        <Sparkles className="w-3 h-3 text-amber-400" />
        {positionLabel}
      </span>

      {/* Container 3D da Carta */}
      <button
        id={buttonId}
        type="button"
        aria-label={actionLabel || (isLocked ? `Desbloquear ${positionLabel}` : `${showFace ? "Virar" : "Revelar"} ${showFace ? card.name || positionLabel : positionLabel}`)}
        aria-pressed={actionLabel || isLocked ? undefined : showFace}
        onClick={onCardClick}
        className={`${compact === "single" ? "w-[min(72vw,280px,calc(55.8dvh_-_106px))] min-w-[180px]" : compact === "pair" ? "w-[32vw] max-w-[140px]" : compact === "detail" ? "w-[min(82vw,360px,calc(55.8dvh_-_84px))]" : "w-36 sm:w-44 md:w-52"} aspect-[24/43] perspective-1000 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 cursor-pointer select-none ${justRevealed ? "oracle-card-reveal" : ""}`}
      >
        <div
          className={`relative w-full h-full duration-500 preserve-3d transition-transform ${
            showFace ? "rotate-y-180" : ""
          }`}
        >
          {/* VERSO DA CARTA (DORSO MÍSTICO / BLOQUEADO) */}
          <div
            className={`absolute inset-0 w-full h-full rounded-xl border-2 backface-hidden flex flex-col items-center justify-between p-3 overflow-hidden shadow-2xl ${
              isLocked
                ? "border-purple-600/60 bg-linear-to-b from-slate-900 via-purple-950 to-slate-950 cosmic-card-glow-locked"
                : `${backStyle} cosmic-card-glow`
            }`}
          >
            {/* Borda ornamental interna */}
            <div className="absolute inset-2 rounded-lg border border-amber-400/20 pointer-events-none" />

            {/* Cabeçalho do Dorso */}
            <div className="w-full flex justify-between items-center text-amber-400/50 text-[10px]">
              <span>★</span>
              <span className="tracking-widest uppercase font-serif text-[9px]">
                {deck === "Linha de Umbanda" ? "Caminhos" : deck === "Cigana Tradicional" ? "Baralho Cigano" : "Oráculo"}
              </span>
              <span>★</span>
            </div>

            {/* Centro do Dorso */}
            <div className="flex flex-col items-center justify-center gap-2 z-10 text-center">
              {isLocked ? (
                <div className="flex flex-col items-center gap-2">
                  <div className={`${compact === "pair" ? "w-9 h-9" : "w-12 h-12"} rounded-full bg-purple-900/60 border border-purple-400/40 flex items-center justify-center shadow-lg animate-pulse-slow`}>
                    <Lock className={`${compact === "pair" ? "w-4 h-4" : "w-6 h-6"} text-purple-300`} />
                  </div>
                  <span className={`${compact === "pair" ? "text-[9px] tracking-normal" : "text-[11px] tracking-wider"} font-semibold text-purple-200 uppercase`}>
                    Bloqueada
                  </span>
                  <span className={`${compact === "pair" ? "hidden" : ""} text-[9px] text-purple-300/70 max-w-[110px]`}>
                    Abra a leitura completa
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <div className="w-14 h-14 rounded-full border border-amber-400/30 flex items-center justify-center bg-indigo-900/30">
                    <div className="w-10 h-10 rounded-full border border-dashed border-amber-400/50 flex items-center justify-center animate-spin" style={{ animationDuration: "20s" }}>
                      <Sparkles className="w-5 h-5 text-amber-300" />
                    </div>
                  </div>
                  <span className="text-[10px] text-amber-300/80 font-serif tracking-widest mt-1">
                    TOQUE PARA REVELAR
                  </span>
                </div>
              )}
            </div>

            {/* Rodapé do Dorso */}
            <div className="w-full flex justify-between items-center text-amber-400/50 text-[10px]">
              <span>★</span>
              <span className="text-[9px] text-slate-400 font-mono">36 cartas</span>
              <span>★</span>
            </div>
          </div>

          {/* FRENTE DA CARTA (REVELADA) */}
          {showFace && <div
            className="absolute inset-0 w-full h-full rounded-xl border-2 rotate-y-180 backface-hidden flex flex-col p-3 overflow-hidden shadow-2xl bg-linear-to-b from-slate-900 via-slate-950 to-black border-amber-400/50 cosmic-card-glow"
          >
            {/* Se houver imagem e não tiver dado erro, mostra a imagem; caso contrário, Fallback Cósmico */}
            {card.imageUrl && !imgError ? (
              <img
                src={card.imageUrl}
                alt={card.name || "Carta"}
                className="absolute inset-0 w-full h-full object-contain bg-slate-950"
                onError={() => setImgError(true)}
              />
            ) : (
              /* Fallback Cósmico Procedural Elegante */
              <div className="w-full h-full flex flex-col justify-between relative">
                {/* Borda interna refinada */}
                <div className="absolute inset-0 rounded-lg border border-amber-400/20 pointer-events-none" />

                {/* Cabeçalho */}
                <div className="flex justify-between items-center z-10">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-xs font-bold font-mono text-amber-300">
                    {card.id}
                  </div>
                  
                </div>

                {/* Ilustração Cósmica Central */}
                <div className="my-auto flex flex-col items-center justify-center p-2 text-center">
                  <div className="w-16 h-16 rounded-full bg-linear-to-tr from-purple-800/40 via-cyan-900/40 to-amber-600/30 border border-amber-400/40 flex items-center justify-center shadow-inner mb-2">
                    <Sparkles className="w-8 h-8 text-amber-300 animate-pulse-slow" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-100 font-serif leading-tight">
                    {card.name}
                  </h3>
                </div>


              </div>
            )}
          </div>}
        </div>
      </button>
      <style jsx global>{`
        @keyframes oracle-card-settle {
          0% { transform: translateX(-14px) translateY(-8px) rotate(-3deg); }
          35% { transform: translateX(8px) translateY(2px) rotate(2deg); }
          62% { transform: translateX(0) translateY(0) rotate(0); }
          100% { transform: translateX(0) translateY(0) rotate(0); }
        }
        .oracle-card-reveal { animation: oracle-card-settle 760ms ease-out both; }
        @media (prefers-reduced-motion: reduce) { .oracle-card-reveal { animation: none; } }
      `}</style>
    </div>
  );
};
