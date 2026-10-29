"use client";

import { useLayoutEffect, useRef } from "react";
import Image from "next/image";
import type { ReadingSessionPayload } from "@/types";

export function ConsultationTable({ cards, revealed, current, highlighted, onSelect, mobilePositions, mobileLabel, disabled = false, deckId, referencePosition }: {
  cards: ReadingSessionPayload["cardsDrawn"];
  revealed: number;
  current: number | null;
  highlighted: number[];
  onSelect: (position: number) => void;
  mobilePositions?: number[];
  mobileLabel?: string;
  disabled?: boolean;
  deckId?: string;
  referencePosition?: number;
}) {
  const columns = cards.length === 36 ? 9 : cards.length === 9 ? 3 : cards.length;
  const deck = useRef<HTMLButtonElement>(null);
  const map = useRef<HTMLDivElement>(null);
  const previous = useRef(revealed);

  useLayoutEffect(() => {
    const old = previous.current;
    previous.current = revealed;
    if (revealed !== old + 1) return;
    const art = map.current?.querySelector<HTMLElement>(`[data-position="${revealed}"] .consultation-card-art`);
    const source = deck.current?.querySelector(".consultation-deck-back:last-child")?.getBoundingClientRect() || deck.current?.getBoundingClientRect();
    const target = art?.getBoundingClientRect();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!source?.width || !source.height || !target?.width || !target.height || !art?.animate) return;
    const dx = source.left + source.width / 2 - target.left - target.width / 2;
    const dy = source.top + source.height / 2 - target.top - target.height / 2;
    const flight = art.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${source.width / target.width}, ${source.height / target.height}) rotateY(180deg) rotate(-5deg)`, opacity: 1 },
      { transform: `translate(${dx * .55}px, ${dy * .55}px) scale(1) rotateY(180deg) rotate(-2deg)`, opacity: 1, offset: .35 },
      { transform: "translate(0, 0) scale(1) rotateY(0) rotate(0)", opacity: 1 },
    ], { duration: 600, easing: "cubic-bezier(.22,.75,.22,1)" });
    return () => flight.cancel();
  }, [revealed]);

  const remaining = Math.max(0, cards.length - revealed);
  return <div className="consultation-deal-area" data-card-count={cards.length}>
    <div className="consultation-real-deck">
      <button ref={deck} id={deckId} type="button" className={`consultation-deck-button ${remaining || disabled ? "" : "is-empty"}`} disabled={disabled || remaining === 0} onClick={() => onSelect(revealed + 1)} aria-label={remaining ? `Tirar próxima carta · posição ${revealed + 1}` : "Todas as cartas foram tiradas"}>
        {Array.from({ length: Math.min(3, remaining || (disabled ? 1 : 0)) }, (_, index) => <span key={index} className="consultation-deck-back" aria-hidden="true"><span>✦</span></span>)}
      </button>
      <p className="consultation-deck-instruction">{remaining ? disabled ? "Revelando sua carta…" : "Toque no baralho para tirar a próxima carta" : "Todas as cartas estão na mesa"}</p>
    </div>
    <div ref={map} className="consultation-map" data-card-count={cards.length} data-mobile-focus={Boolean(mobilePositions?.length)} aria-busy={disabled}>
      {mobileLabel && <p className="mb-3 text-center text-sm font-medium text-amber-100 lg:hidden">{mobileLabel}</p>}
      <div role="group" aria-label="Cartas da mesa em suas posições originais" className="consultation-card-grid" style={{ gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` }}>
        {cards.map((card) => {
          const visible = card.position <= revealed;
          const next = card.position === revealed + 1;
          const focused = current === card.position;
          const reference = visible && referencePosition === card.position;
          const neighbor = visible && referencePosition !== undefined && highlighted.includes(card.position) && !reference;
          const dimmed = visible && highlighted.length > 0 && !highlighted.includes(card.position);
          return <button key={card.position} data-position={card.position} type="button" disabled={disabled || !visible} onClick={() => onSelect(card.position)} aria-pressed={visible && focused} aria-label={visible ? `Ampliar posição ${card.position}: ${card.name?.replace(/^\d+\.\s*/, "") || "Carta"}${reference ? ", carta do tema" : ""}` : `Posição ${card.position} ainda vazia`} className={`consultation-card-slot ${visible ? "is-filled" : "is-empty"} ${card.position === revealed ? "is-latest" : ""} ${focused && visible ? "is-selected" : ""} ${reference ? "is-reference" : neighbor ? "is-neighbor" : ""} ${next ? "is-next" : ""} ${dimmed ? "is-dimmed" : ""} ${mobilePositions && !mobilePositions.includes(card.position) ? "outside-mobile-group" : ""}`}>
            {visible && <span className="consultation-card-art">
              <span className="consultation-flight-back" aria-hidden="true">✦</span>
              <span className="consultation-flight-front">
              {card.imageUrl ? <Image src={card.imageUrl} alt="" fill sizes={mobilePositions ? "(max-width: 1023px) 30vw, 60px" : columns === 9 ? "(max-width: 1023px) 10vw, 60px" : "100px"} priority={card.position === revealed} quality={70} className="object-contain" /> : <span className="flex h-full items-center justify-center p-1 text-center text-xs text-amber-100">{card.name?.replace(/^\d+\.\s*/, "") || "Carta"}</span>}
              </span>
            </span>}
            <span className="consultation-position" aria-hidden="true">{card.position}</span>
          </button>;
        })}
      </div>
      <p className="mt-3 text-center text-xs leading-relaxed text-slate-200">{revealed} de {cards.length} cartas abertas{revealed ? " · Toque em uma carta para ampliar" : ""}</p>
    </div>
  </div>;
}
