"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { ReadingSessionPayload } from "@/types";
import { chapterForPosition, physicalChapter } from "@/lib/spread-navigation";
import { canReadChapter, chapterHint, presentationSections, themeFocusId } from "@/lib/reading-chapters";
import { useRevealTransition } from "@/lib/reveal-transition";
import { ConsultationWorkspace } from "./ConsultationWorkspace";
import { ConsultationTable } from "./ConsultationTable";
import { ConsultationReadingPane } from "./ConsultationReadingPane";
import { ReadingAudio } from "./ReadingAudio";
import { LiveConsultation } from "./LiveConsultation";

export function SpreadBoard({ session, onReset }: { session: ReadingSessionPayload; onReset: () => void }) {
  const [chapter, setChapter] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<"card" | "overview">("card");
  const [expanded, setExpanded] = useState(false);
  const detail = useRef<HTMLDialogElement>(null);
  const reading = useRef<HTMLElement>(null);
  const spread = session.spread || "line3";
  const chapters = useMemo(() => presentationSections(spread, session.sections || []), [spread, session.sections]);
  const revealingPosition = useRevealTransition(session.id);
  const openedChapters = useRef(new Set<string>());
  const busy = revealingPosition !== null;
  const physicalRows = spread === "grand36" ? 4 : spread === "box9" ? 3 : 1;
  const synthesis = chapter === chapters.length;
  const section = chapters[chapter];
  const positions = synthesis ? session.cardsDrawn.map((item) => item.position) : section?.positions || [];
  const available = positions.filter((position) => position <= revealed);
  const chapterId = synthesis ? "synthesis" : section?.id || "section1";
  const ready = !busy && canReadChapter(spread, chapterId, positions, revealed, session.cardsDrawn.length, session.methodVersion);
  const allReady = !busy && revealed === session.cardsDrawn.length;
  const themeCard = spread === "grand36" && allReady ? session.cardsDrawn.find((item) => item.id === themeFocusId(session.theme)) : undefined;
  const reference = chapterId === "section5" && themeCard && positions.includes(themeCard.position) ? themeCard : undefined;
  const referenceDescription = reference ? `Carta do tema: ${reference.name?.replace(/^\d+\.\s*/, "")} · posição ${reference.position}. Este recorte tem ${positions.length} cartas${positions.length < 9 ? "; nas bordas e nos cantos, há menos vizinhas" : ", incluindo a referência e suas oito vizinhas"}.` : undefined;
  const current = selected !== null && available.includes(selected) ? selected : available[0] ?? null;
  const card = current === null ? null : session.cardsDrawn.find((item) => item.position === current) ?? null;
  const note = allReady ? session.cardNotes?.find((item) => item.position === current)?.text : undefined;
  const audioAvailable = ready && (chapter < physicalRows || (synthesis && spread !== "line3"));
  const lockedMessage = allReady ? undefined : ready ? "A leitura desta linha está pronta na opção Leitura da linha. Os textos individuais, que podem cruzar outras linhas, serão liberados ao completar a mesa." : spread === "grand36" && session.methodVersion === "lenormand-grand36-v2" && chapter < physicalRows ? "Revele as nove cartas desta linha. A interpretação será apresentada em seguida." : "Primeiro revele todas as cartas da mesa. Depois, explore as interpretações e as relações entre elas.";
  const focusReadingOnMobile = () => {
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    window.requestAnimationFrame(() => {
      reading.current?.focus({ preventScroll: true });
      reading.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });
  };

  useEffect(() => {
    if (expanded && detail.current && !detail.current.open) detail.current.showModal();
  }, [expanded]);

  useEffect(() => {
    if (ready && !openedChapters.current.has(chapterId)) {
      openedChapters.current.add(chapterId);
      setActiveView("overview");
      if (window.matchMedia("(max-width: 1023px)").matches) window.requestAnimationFrame(() => reading.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
    }
  }, [ready, chapterId]);

  useEffect(() => {
    const onChapterFocus = (event: Event) => {
      const { sessionId, chapter: id } = (event as CustomEvent<{ sessionId: string; chapter: string }>).detail || {};
      if (sessionId !== session.id) return;
      const index = id === "synthesis" ? chapters.length : chapters.findIndex((item) => item.id === id);
      if (index < 0) return;
      const target = index === chapters.length ? session.cardsDrawn.map((item) => item.position) : chapters[index].positions;
      if (busy || !canReadChapter(spread, id, target, revealed, session.cardsDrawn.length, session.methodVersion)) return;
      setChapter(index);
      setSelected(target[0] ?? null);
      setActiveView("overview");
      reading.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "nearest" });
    };
    window.addEventListener("oracle-chapter-focus", onChapterFocus);
    return () => window.removeEventListener("oracle-chapter-focus", onChapterFocus);
  }, [session.id, session.cardsDrawn, session.methodVersion, chapters, revealed, busy, spread]);

  const revealNext = () => {
    if (busy || revealed >= session.cardsDrawn.length) return;
    const position = revealed + 1;
    setRevealed(position);
    setSelected(position);
    setActiveView("card");
    const index = physicalChapter(position, session.spread);
    if (index < (session.spread === "grand36" ? 4 : session.spread === "box9" ? 3 : 1)) setChapter(index);
    window.dispatchEvent(new CustomEvent("oracle-reveal", { detail: { sessionId: session.id, position, total: session.cardsDrawn.length } }));
  };

  const showCard = (position: number) => {
    if (busy) return;
    if (position === revealed + 1) { revealNext(); return; }
    if (position > revealed) return;
    const index = chapterForPosition(chapters, chapter, position);
    if (index >= 0) setChapter(index);
    setSelected(position);
    setActiveView("card");
    focusReadingOnMobile();
  };

  const selectChapter = (index: number) => {
    if (busy) return;
    setChapter(index);
    const target = index === chapters.length ? session.cardsDrawn.map((item) => item.position) : chapters[index]?.positions || [];
    setSelected(chapters[index]?.id === "section5" && spread === "grand36" && themeCard && target.includes(themeCard.position) ? themeCard.position : target.find((position) => position <= revealed) ?? null);
    setActiveView(index >= physicalRows || canReadChapter(spread, chapters[index]?.id || "", target, revealed, session.cardsDrawn.length, session.methodVersion) ? "overview" : "card");
    focusReadingOnMobile();
  };

  const moveCard = (step: number) => {
    if (busy || current === null) return;
    const next = available[available.indexOf(current) + step];
    if (next !== undefined) setSelected(next);
    else if (step > 0 && current === revealed && revealed < session.cardsDrawn.length) revealNext();
  };

  const table = <section className="min-w-0">
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <h2 className="hidden font-serif text-base text-amber-100 lg:block">Sua mesa · {session.cardsDrawn.length} cartas</h2>
      <div className="min-w-[min(100%,220px)] flex-1 sm:max-w-xs">
        <label htmlFor="spread-chapter" className="text-xs uppercase tracking-wider text-slate-300">Acompanhar a leitura</label>
        <select id="spread-chapter" value={chapter} disabled={busy} onChange={(event) => selectChapter(Number(event.target.value))} className="mt-1 min-h-12 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 text-sm text-slate-100">
          {chapters.map((item, index) => <option key={item.id} value={index}>{index + 1}. {item.title}</option>)}
          {spread !== "line3" && <option value={chapters.length}>Resumo final</option>}
        </select>
      </div>
    </div>
    {referenceDescription && <p role="note" className="mb-3 text-sm leading-relaxed text-cyan-100">{referenceDescription}</p>}
    <ConsultationTable cards={session.cardsDrawn} revealed={revealed} current={current} highlighted={positions} onSelect={showCard} disabled={busy} mobilePositions={spread === "grand36" && chapter < physicalRows ? positions : undefined} mobileLabel={spread === "grand36" && chapter < physicalRows ? `${section?.title} · ${available.length} de ${positions.length} cartas` : undefined} deckId={`oracle-deck-${session.id}`} referencePosition={reference?.position} />
    {spread === "grand36" && synthesis && <nav aria-label="Aproximar uma linha da mesa" className="mt-3 grid grid-cols-2 gap-2 lg:hidden">{Array.from({ length: 4 }, (_, index) => <button type="button" key={index} onClick={() => selectChapter(index)} className="min-h-12 rounded-xl border border-amber-200/40 px-3 text-sm text-amber-100">Ver linha {index + 1}</button>)}</nav>}
  </section>;

  return <ConsultationWorkspace session={session} table={table}>
    <section ref={reading} tabIndex={-1} className="min-w-0 scroll-mt-24 focus:outline-none">
      <ConsultationReadingPane
        title={synthesis ? "Sua leitura completa" : section?.title || "Sua leitura"}
        subtitle={referenceDescription || (synthesis ? "Todas as cartas da mesma mesa, conectadas em uma síntese." : chapterHint(spread, chapterId))}
        card={card}
        note={note}
        revealed={current !== null}
        revealing={revealingPosition === current}
        readingLockedMessage={lockedMessage}
        audio={audioAvailable ? <ReadingAudio key={chapterId} sessionId={session.id} chapter={chapterId} title={synthesis ? "Resumo final" : section?.title} /> : null}
        overview={ready ? synthesis ? session.aiReading.generalSynthesis : section?.text : undefined}
        overviewTitle={synthesis ? "Resumo final" : chapter < physicalRows ? "Leitura da linha" : "Leitura das relações"}
        onPrevious={() => moveCard(-1)}
        onNext={() => moveCard(1)}
        canPrevious={!busy && current !== null && available.indexOf(current) > 0}
        canNext={!busy && current !== null && (available.indexOf(current) < available.length - 1 || current === revealed && revealed < session.cardsDrawn.length)}
        onEnlarge={card && !busy ? () => setExpanded(true) : undefined}
        revealAction={revealed < session.cardsDrawn.length ? <button type="button" disabled={busy} onClick={() => document.getElementById(`oracle-deck-${session.id}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" })} className="min-h-12 rounded-xl border border-amber-300/50 px-4 py-3 text-sm font-semibold text-amber-100 disabled:opacity-50">{busy ? "Revelando sua carta…" : "Voltar ao baralho"}</button> : !synthesis && allReady && spread !== "line3" ? <button type="button" onClick={() => selectChapter(chapters.length)} className="min-h-12 rounded-xl border border-amber-300/50 px-4 text-sm text-amber-100">Ver resumo final</button> : undefined}
        activeView={activeView}
        onViewChange={setActiveView}
      />
      {allReady && <details className="mt-6 rounded-2xl border border-cyan-500/30 bg-slate-950/50 p-3"><summary className="cursor-pointer text-sm font-semibold text-cyan-200">Converse sobre sua leitura</summary><div className="mt-3"><LiveConsultation session={session} /></div></details>}
      <div className="flex flex-wrap justify-center gap-5 py-6 text-sm text-slate-400">
        {revealed === session.cardsDrawn.length && <a href={`/api/reading/${session.id}/export`} download className="underline underline-offset-4">Baixar consulta em texto</a>}
        <button type="button" onClick={onReset} className="underline underline-offset-4">Voltar às consultas</button>
      </div>
    </section>
    {expanded && card && <dialog ref={detail} onClose={() => setExpanded(false)} className="max-h-[94dvh] max-w-[94vw] overflow-y-auto rounded-2xl border border-amber-400/30 bg-slate-950 p-5 text-slate-100 backdrop:bg-black/85" aria-labelledby="spread-card-title">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 id="spread-card-title" className="font-serif">Posição {current} · {card.name}</h2><button type="button" onClick={() => detail.current?.close()} aria-label="Fechar carta" className="rounded-full bg-slate-800 p-2"><X size={20} /></button></div>
      {card.imageUrl && <img src={card.imageUrl} alt={card.name || "Carta"} className="mx-auto max-h-[58dvh] max-w-full rounded-lg object-contain" />}
      <p className="reading-copy mt-5 max-w-md">{note}</p>
    </dialog>}
  </ConsultationWorkspace>;
}

