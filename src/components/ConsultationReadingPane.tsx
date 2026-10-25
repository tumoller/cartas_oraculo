"use client";

import { useRef, type ReactNode, type TouchEvent } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ReadingSessionPayload } from "@/types";

type CardDraw = ReadingSessionPayload["cardsDrawn"][number];

export function ConsultationReadingPane({ title, subtitle, card, note, revealed, audio, overview, overviewTitle = "Leitura da linha", onPrevious, onNext, canPrevious, canNext, onEnlarge, revealAction, activeView, onViewChange, revealing = false, readingLockedMessage }: {
  title: string;
  subtitle?: string;
  card: CardDraw | null;
  note?: string;
  revealed: boolean;
  audio: ReactNode;
  overview?: ReactNode;
  overviewTitle?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  canPrevious: boolean;
  canNext: boolean;
  onEnlarge?: () => void;
  revealAction?: ReactNode;
  activeView: "card" | "overview";
  onViewChange: (view: "card" | "overview") => void;
  revealing?: boolean;
  readingLockedMessage?: string;
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const cardName = card?.name?.replace(/^\d+\.\s*/, "") || "Carta";
  const onTouchStart = (event: TouchEvent) => {
    touchStart.current = { x: event.touches[0]?.clientX ?? 0, y: event.touches[0]?.clientY ?? 0 };
  };
  const onTouchEnd = (event: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const x = (event.changedTouches[0]?.clientX ?? start.x) - start.x;
    const y = (event.changedTouches[0]?.clientY ?? start.y) - start.y;
    if (Math.abs(x) < 55 || Math.abs(x) <= Math.abs(y) * 1.3) return;
    if (x < 0 && canNext) onNext?.();
    if (x > 0 && canPrevious) onPrevious?.();
  };

  return <section className="min-w-0" aria-label="Leitura da consulta">
    <header>
      <h2 className="font-serif text-xl text-amber-100 sm:text-2xl">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-300">{subtitle}</p>}
    </header>
    <div role="group" aria-label="Visualização da leitura" className="mt-4 flex gap-1 border-b border-white/15">
      <button type="button" aria-pressed={activeView === "card"} onClick={() => onViewChange("card")} className={`min-h-12 border-b-2 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 ${activeView === "card" ? "border-amber-300 text-amber-100" : "border-transparent text-slate-300"}`}>Carta selecionada</button>
      <button type="button" aria-pressed={activeView === "overview"} onClick={() => onViewChange("overview")} className={`min-h-12 border-b-2 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 ${activeView === "overview" ? "border-amber-300 text-amber-100" : "border-transparent text-slate-300"}`}>{overviewTitle}</button>
    </div>
    <div hidden={activeView !== "overview"}>{audio}</div>
    {activeView === "overview" ? <div className="pt-4">
      {overview ? <div className="reading-copy mt-4 whitespace-pre-line text-slate-100">{overview}</div> : <p role="status" className="text-sm leading-6 text-slate-300">{readingLockedMessage || "Revele as cartas desta parte para ler a interpretação."}</p>}
    </div> : <div className="pt-4">
      {revealed && card ? <>
        <article className="mt-4" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="mb-3 flex items-center gap-2"><span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-200">Posição {card.position}</span><h3 className="font-serif text-lg text-amber-100">{cardName}</h3></div>
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(190px,250px)_minmax(0,1fr)]">
            <div className="mx-auto w-full max-w-[250px]">
              <div className="featured-card relative mx-auto aspect-[24/43] h-[min(300px,72vw)] w-auto rounded-lg sm:h-[310px]">
                <div key={card.position} className={`featured-card-turn ${revealing ? "is-revealing" : ""}`}>
                  <span className="featured-card-back" aria-hidden="true">✦</span>
                  <div className="featured-card-front">
                    {card.imageUrl ? <Image key={card.position} src={card.imageUrl} alt={cardName} fill sizes="180px" className="object-contain" /> : <div className="flex h-full items-center justify-center p-4 text-center font-serif text-amber-100">{cardName}</div>}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <button type="button" onClick={onPrevious} disabled={!canPrevious} aria-label="Carta anterior" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-slate-800 text-slate-100 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"><ArrowLeft size={20} /></button>
                <span className="text-xs text-slate-300">Carta {card.position}</span>
                <button type="button" onClick={onNext} disabled={!canNext} aria-label="Próxima carta" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-slate-800 text-slate-100 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"><ArrowRight size={20} /></button>
              </div>
            </div>
            <div className="min-w-0 text-left">
              {note ? <p className="reading-copy whitespace-pre-line text-lg leading-relaxed text-slate-100">{note}</p> : readingLockedMessage && <p role="status" className="reading-copy text-slate-300">{revealing ? "Revelando sua carta…" : readingLockedMessage}</p>}
              {onEnlarge && <button type="button" onClick={onEnlarge} className="mt-4 min-h-12 rounded-xl border border-amber-400/40 px-4 text-sm text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">Ampliar carta</button>}
            </div>
          </div>
        </article>
      </> : <div role="status" className="rounded-xl bg-slate-900/80 p-5 text-center text-sm leading-6 text-slate-200">Esta carta ainda está fechada. Revele a próxima posição para continuar.</div>}
    </div>}
    {revealAction && <div className="mt-5">{revealAction}</div>}
  </section>;
}
