"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import Image from "next/image";
import type { ReadingSessionPayload } from "@/types";

type Card = ReadingSessionPayload["cardsDrawn"][number];

export function CardRevealDialog({ card, note, onClose }: { card: Card | null; note?: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (card && !dialog.current?.open) dialog.current?.showModal();
    else if (!card && dialog.current?.open) dialog.current.close();
  }, [card]);

  return <dialog ref={dialog} onClose={onClose} aria-labelledby="revealed-card-title" className="max-h-[95dvh] max-w-[95vw] overflow-y-auto rounded-2xl border border-amber-400/40 bg-slate-950 p-4 text-slate-100 shadow-2xl backdrop:bg-slate-950/90 sm:p-5">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id="revealed-card-title" className="font-serif text-lg">{card ? `Carta ${card.position} · ${card.name?.replace(/^\d+\.\s*/, "") || "Carta"}` : "Carta"}</h2>
      <button type="button" onClick={() => dialog.current?.close()} aria-label="Fechar carta" className="rounded-full p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"><X size={20} /></button>
    </div>
    {card && <>
      <button type="button" onClick={() => dialog.current?.close()} aria-label="Fechar carta e voltar ao jogo" className="mx-auto block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
        <span key={card.position} className="block [animation:card-appear_.45s_ease-out_both] motion-reduce:animate-none">
          {card.imageUrl ? <Image src={card.imageUrl} alt={card.name || "Carta"} width={480} height={860} sizes="(max-width: 640px) 90vw, 480px" className="max-h-[72dvh] max-w-full rounded-lg object-contain" /> : <span className="block p-12 font-serif text-amber-100">{card.name || "Carta"}</span>}
        </span>
      </button>
      {note && <p className="reading-copy mt-4 max-w-lg whitespace-pre-line">{note}</p>}
      <p className="mt-3 text-center text-xs text-slate-300">Toque na carta para voltar ao jogo</p>
    </>}
    <style jsx global>{`@keyframes card-appear { from { opacity: .5; transform: rotateY(90deg) scale(.9); } to { opacity: 1; transform: rotateY(0) scale(1); } }`}</style>
  </dialog>;
}
