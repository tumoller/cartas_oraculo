"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useRevealTransition } from "@/lib/reveal-transition";
import type { ReadingSessionPayload } from "@/types";
import { ConsultationReadingPane } from "./ConsultationReadingPane";
import { ConsultationTable } from "./ConsultationTable";
import { ConsultationWorkspace } from "./ConsultationWorkspace";
import { LiveConsultation } from "./LiveConsultation";
import { PixModal } from "./PixModal";
import { ReadingAudio } from "./ReadingAudio";
import { WhatsAppUpsell } from "./WhatsAppUpsell";

const POSITION_NAMES = ["A Raiz / Passado", "O Momento Atual", "O Alerta Oculto", "A Chave de Ação", "O Desfecho & Sorte"];

export function ReadingBoard({ initialSession, onReset }: { initialSession: ReadingSessionPayload; onReset: () => void }) {
  const [session, setSession] = useState(initialSession);
  const [revealed, setRevealed] = useState(0);
  const [position, setPosition] = useState(1);
  const [activeView, setActiveView] = useState<"card" | "overview">("card");
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [enlargedPosition, setEnlargedPosition] = useState<number | null>(null);
  const revealedEvents = useRef(new Set<number>());
  const cardDialog = useRef<HTMLDialogElement>(null);
  const chapterRef = useRef<HTMLDivElement>(null);
  const overviewOpened = useRef("");
  const revealingPosition = useRevealTransition(session.id);
  const activeCard = session.cardsDrawn[position - 1] ?? null;
  const isVisible = position <= revealed;
  const groupReady = revealed === (session.isPaid ? 5 : 3) && revealingPosition === null;
  const synthesisReady = session.isPaid && groupReady;
  const chapter = activeView === "overview" && synthesisReady ? "synthesis" : "cards";

  useEffect(() => {
    const group = session.isPaid ? "paid" : "preview";
    if (groupReady && overviewOpened.current !== group) {
      overviewOpened.current = group;
      setActiveView("overview");
      if (window.matchMedia("(max-width: 1023px)").matches) window.requestAnimationFrame(() => chapterRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
    }
  }, [groupReady, session.isPaid]);

  const reveal = (next: number) => {
    if (revealingPosition !== null) return;
    if (next < 1 || next > 5) return;
    if (!session.isPaid && next >= 4) { setIsPixModalOpen(true); return; }
    if (next > revealed + 1) return;
    setActiveView("card");
    setPosition(next);
    if (next !== revealed + 1) return;
    setRevealed(next);
    if (!revealedEvents.current.has(next)) {
      revealedEvents.current.add(next);
      window.dispatchEvent(new CustomEvent("oracle-reveal", { detail: { sessionId: session.id, position: next, total: session.cardsDrawn.length } }));
    }
  };

  const showChapter = (next: string, mobileOnly = false) => {
    if (next !== "synthesis" || !synthesisReady) return;
    setActiveView("overview");
    if (!mobileOnly || window.matchMedia("(max-width: 1023px)").matches) {
      window.requestAnimationFrame(() => chapterRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
    }
  };

  useEffect(() => {
    const onChapterFocus = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId: string; chapter: string }>).detail;
      if (detail?.sessionId === session.id) showChapter(detail.chapter);
    };
    window.addEventListener("oracle-chapter-focus", onChapterFocus);
    return () => window.removeEventListener("oracle-chapter-focus", onChapterFocus);
  });

  useEffect(() => {
    if (enlargedPosition !== null && !cardDialog.current?.open) cardDialog.current?.showModal();
  }, [enlargedPosition]);

  const text = position === 1 ? session.aiReading.card1Reading
    : position === 2 ? session.aiReading.card2Reading
      : position === 3 ? (session.isPaid ? session.aiReading.card3Full || session.aiReading.card3Teaser : session.aiReading.card3Teaser)
        : position === 4 ? session.aiReading.card4Reading : session.aiReading.card5Reading;
  const preview = [session.aiReading.card1Reading, session.aiReading.card2Reading, session.aiReading.card3Teaser].filter(Boolean).join("\n\n");

  const selectFromTable = (next: number) => {
    if (revealingPosition !== null) return;
    if (next === revealed + 1) { reveal(next); return; }
    reveal(next);
    if (window.matchMedia("(max-width: 1023px)").matches && next <= revealed + 1) {
      window.requestAnimationFrame(() => chapterRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
    }
  };

  const table = <section className="min-w-0">
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <h2 className="hidden font-serif text-base text-amber-100 lg:block">Sua mesa · 5 cartas</h2>
      <div className="min-w-[min(100%,220px)] flex-1 sm:max-w-xs">
        <label htmlFor="five-chapter" className="text-xs uppercase tracking-wider text-slate-300">Acompanhar a leitura</label>
        <select id="five-chapter" value={activeView === "overview" ? "overview" : "card" + position} onChange={(event) => {
          if (event.target.value === "overview") setActiveView("overview");
          else { setPosition(Number(event.target.value.slice(4))); setActiveView("card"); }
        }} disabled={revealingPosition !== null} className="mt-1 min-h-12 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 text-sm text-slate-100">
          {session.cardsDrawn.map((card) => <option key={card.position} value={"card" + card.position} disabled={card.position > revealed}>Carta {card.position}</option>)}
          <option value="overview" disabled={!groupReady}>{session.isPaid ? "Leitura das cinco cartas" : "Prévia das três cartas"}</option>
        </select>
      </div>
    </div>
    <ConsultationTable cards={session.cardsDrawn} revealed={revealed} current={activeView === "card" ? position : null} highlighted={[]} onSelect={selectFromTable} disabled={revealingPosition !== null} deckId={`oracle-deck-${session.id}`} />
  </section>;

  return <>
    <ConsultationWorkspace session={session} table={table}>
      <div className="space-y-5">
        <div ref={chapterRef} data-reading-chapter={chapter} className="scroll-mt-24">
          <ConsultationReadingPane
            title={"Leitura de " + session.userName}
            subtitle={activeView === "card" ? "Carta " + position + " de 5" + (session.methodVersion === "lenormand-line-v1" ? "" : " · " + POSITION_NAMES[position - 1]) : session.isPaid ? "As cinco cartas da sua mesa" : "As três cartas da sua prévia"}
            card={activeCard}
            note={isVisible && groupReady ? text ?? undefined : undefined}
            revealed={isVisible}
            revealing={revealingPosition === position}
            readingLockedMessage={`Revele as ${session.isPaid ? "cinco" : "três"} cartas para ler a interpretação.`}
            audio={synthesisReady ? <ReadingAudio key="synthesis" sessionId={session.id} chapter="synthesis" title="Leitura das cinco cartas" /> : null}
            overview={groupReady ? session.isPaid ? session.aiReading.generalSynthesis : preview : undefined}
            overviewTitle={session.isPaid ? "Leitura das cinco cartas" : "Prévia das três cartas"}
            activeView={activeView}
            onViewChange={setActiveView}
            onPrevious={() => reveal(position - 1)}
            onNext={() => reveal(position + 1)}
            canPrevious={revealingPosition === null && position > 1}
            canNext={revealingPosition === null && position < 5}
            onEnlarge={() => setEnlargedPosition(position)}
            revealAction={revealingPosition === null && revealed < 5 ? <button type="button" onClick={() => { if (!session.isPaid && revealed === 3) { setIsPixModalOpen(true); return; } document.getElementById(`oracle-deck-${session.id}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }); }} className="min-h-12 rounded-xl border border-amber-300/50 px-5 py-3 text-sm font-semibold text-amber-100">{!session.isPaid && revealed === 3 ? "Abrir leitura completa" : "Voltar ao baralho"}</button> : null}
          />
        </div>
        {synthesisReady && <details className="rounded-2xl border border-cyan-500/30 bg-slate-950/50 p-3"><summary className="cursor-pointer text-sm font-semibold text-cyan-200">Converse sobre sua leitura</summary><div className="mt-3"><LiveConsultation session={session} /></div></details>}
        {session.isPaid && revealed === 5 && <WhatsAppUpsell session={session} />}
        <button type="button" onClick={onReset} className="mx-auto block min-h-11 text-sm text-slate-300 underline underline-offset-4">Realizar nova leitura</button>
      </div>
    </ConsultationWorkspace>
    <dialog ref={cardDialog} onClose={() => setEnlargedPosition(null)} aria-labelledby="enlarged-card-title" className="fixed max-h-[95dvh] max-w-[95vw] overflow-y-auto rounded-2xl border border-amber-400/40 bg-slate-950 p-4 text-slate-100 shadow-2xl backdrop:bg-slate-950/90">
      <div className="mb-4 flex items-center justify-between gap-4"><h3 id="enlarged-card-title" className="font-serif text-base">{enlargedPosition ? "Carta " + enlargedPosition + ": " + (session.cardsDrawn[enlargedPosition - 1]?.name || "") : "Carta ampliada"}</h3><button type="button" onClick={() => cardDialog.current?.close()} aria-label="Fechar carta ampliada" className="rounded-full p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"><X className="h-5 w-5" /></button></div>
      {enlargedPosition && (session.cardsDrawn[enlargedPosition - 1]?.imageUrl
        ? <img key={enlargedPosition} src={session.cardsDrawn[enlargedPosition - 1].imageUrl!} alt={session.cardsDrawn[enlargedPosition - 1].name || "Carta"} className="mx-auto max-h-[75dvh] max-w-full rounded-lg object-contain" />
        : <p className="p-12 text-center font-serif text-amber-100">{session.cardsDrawn[enlargedPosition - 1]?.name || "Carta"}</p>)}
    </dialog>
    <PixModal isOpen={isPixModalOpen} onClose={() => setIsPixModalOpen(false)} sessionId={session.id} onSuccess={setSession} />
  </>;
}
