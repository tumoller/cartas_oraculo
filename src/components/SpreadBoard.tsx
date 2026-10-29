"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReadingSessionPayload } from "@/types";
import { setSoundPreference } from "@/lib/sound-preference";
import { physicalChapter } from "@/lib/spread-navigation";
import { canReadChapter, chapterHint, presentationSections, themeFocusId } from "@/lib/reading-chapters";
import { useRevealTransition } from "@/lib/reveal-transition";
import { ConsultationWorkspace } from "./ConsultationWorkspace";
import { ConsultationTable } from "./ConsultationTable";
import { ConsultationReadingPane } from "./ConsultationReadingPane";
import { ReadingAudio } from "./ReadingAudio";
import { LiveConsultation } from "./LiveConsultation";
import { CardRevealDialog } from "./CardRevealDialog";
import { NarrationChoice } from "./NarrationChoice";
import { LiveInviteDialog } from "./LiveInviteDialog";

export function SpreadBoard({ session, onReset, initialNarration }: { session: ReadingSessionPayload; onReset: () => void; initialNarration?: boolean }) {
  const [chapter, setChapter] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<"card" | "overview">("card");
  const [enlargedPosition, setEnlargedPosition] = useState<number | null>(null);
  const [narration, setNarration] = useState<boolean | null>(initialNarration ?? null);
  const [autoplayChapter, setAutoplayChapter] = useState<string | null>(null);
  const [showLiveInvite, setShowLiveInvite] = useState(false);
  const liveInviteDismissed = useRef(false);
  const consumedCompletions = useRef(new Set<number>());
  const reading = useRef<HTMLElement>(null);
  const spread = session.spread || "line3";
  const chapters = useMemo(() => presentationSections(spread, session.sections || []), [spread, session.sections]);
  const revealingPosition = useRevealTransition(session.id);
  const openedChapters = useRef(new Set<string>());
  const finalOpened = useRef(false);
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
  const audioAvailable = narration === true && !synthesis;
  const lockedMessage = allReady ? undefined : ready ? "A leitura desta linha está pronta na opção Leitura da linha. Os textos individuais, que podem cruzar outras linhas, serão liberados ao completar a mesa." : spread === "grand36" && session.methodVersion === "lenormand-grand36-v2" && chapter < physicalRows ? "Revele as nove cartas desta linha. A interpretação será apresentada em seguida." : "Primeiro revele todas as cartas da mesa. Depois, explore as interpretações e as relações entre elas.";
  const focusReadingOnMobile = () => {
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    window.requestAnimationFrame(() => {
      reading.current?.focus({ preventScroll: true });
      reading.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });
  };

  useEffect(() => {
    if (busy || enlargedPosition !== null) return;
    for (let r = 0; r < physicalRows; r++) {
      const rowPositions = chapters[r]?.positions || [];
      const rowComplete = rowPositions.length > 0 && rowPositions.every((pos) => pos <= revealed);
      if (rowComplete && !consumedCompletions.current.has(r)) {
        consumedCompletions.current.add(r);
        setChapter(r);
        setActiveView("overview");
        if (narration === true) {
          const targetId = chapters[r]?.id || null;
          setAutoplayChapter(targetId);
        }
        break;
      }
    }
  }, [busy, enlargedPosition, physicalRows, chapters, revealed, narration]);

  useEffect(() => {
    const onChapterFocus = (event: Event) => {
      const { sessionId, chapter: id } = (event as CustomEvent<{ sessionId: string; chapter: string }>).detail || {};
      if (sessionId !== session.id) return;
      const index = id === "synthesis" ? chapters.length : chapters.findIndex((item) => item.id === id);
      if (index < 0) return;
      const target = index === chapters.length ? session.cardsDrawn.map((item) => item.position) : chapters[index].positions;
      if (busy || enlargedPosition !== null || !canReadChapter(spread, id, target, revealed, session.cardsDrawn.length, session.methodVersion)) return;
      setChapter(index);
      setSelected(target[0] ?? null);
      setActiveView("overview");
    };
    window.addEventListener("oracle-chapter-focus", onChapterFocus);
    return () => window.removeEventListener("oracle-chapter-focus", onChapterFocus);
  }, [session.id, session.cardsDrawn, session.methodVersion, chapters, revealed, busy, spread, enlargedPosition]);

  const revealNext = () => {
    if (busy || revealed >= session.cardsDrawn.length) return;
    const position = revealed + 1;
    setRevealed(position);
    setSelected(position);
    setActiveView("card");
    setEnlargedPosition(position);
    const index = physicalChapter(position, session.spread);
    if (index < (session.spread === "grand36" ? 4 : session.spread === "box9" ? 3 : 1)) setChapter(index);
    window.dispatchEvent(new CustomEvent("oracle-reveal", { detail: { sessionId: session.id, position, total: session.cardsDrawn.length } }));
  };

  const showCard = (position: number) => {
    if (busy) return;
    if (position === revealed + 1) { revealNext(); return; }
    if (position > revealed) return;
    setEnlargedPosition(position);
  };

  const selectChapter = (index: number) => {
    if (busy) return;
    setAutoplayChapter(null);
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

  const navigation = <div className="mt-4 max-w-sm">
    <label htmlFor="spread-chapter" className="text-xs uppercase tracking-wider text-slate-300">Acompanhar a leitura</label>
    <select id="spread-chapter" value={chapter} disabled={busy} onChange={(event) => selectChapter(Number(event.target.value))} className="mt-1 min-h-12 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 text-sm text-slate-100">
      {chapters.map((item, index) => <option key={item.id} value={index}>{index + 1}. {item.title}</option>)}
      {spread !== "line3" && <option value={chapters.length}>Resumo final</option>}
    </select>
    <button type="button" onClick={() => { const enabled = narration !== true; setNarration(enabled); setSoundPreference(enabled); }} className="mt-2 min-h-11 text-sm text-amber-200 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">{narration === true ? "Seguir sem narração" : "Ouvir esta leitura"}</button>
  </div>;

  const table = <section className="min-w-0">
    {narration === null && <NarrationChoice onChoose={(enabled) => { setNarration(enabled); setSoundPreference(enabled); }} />}
    <h2 className="mb-3 hidden font-serif text-base text-amber-100 lg:block">Sua mesa · {session.cardsDrawn.length} cartas</h2>
    {referenceDescription && <p role="note" className="mb-3 text-sm leading-relaxed text-cyan-100">{referenceDescription}</p>}
    <ConsultationTable cards={session.cardsDrawn} revealed={revealed} current={current} highlighted={positions} onSelect={showCard} disabled={busy} mobilePositions={spread === "grand36" && chapter < physicalRows ? positions : undefined} mobileLabel={spread === "grand36" && chapter < physicalRows ? `${section?.title} · ${available.length} de ${positions.length} cartas` : undefined} deckId={`oracle-deck-${session.id}`} referencePosition={reference?.position} />
    {spread === "grand36" && synthesis && <nav aria-label="Aproximar uma linha da mesa" className="mt-3 grid grid-cols-2 gap-2 lg:hidden">{Array.from({ length: 4 }, (_, index) => <button type="button" key={index} onClick={() => selectChapter(index)} className="min-h-12 rounded-xl border border-amber-200/40 px-3 text-sm text-amber-100">Ver linha {index + 1}</button>)}</nav>}
  </section>;

  return <ConsultationWorkspace session={session} table={table}>
    <section ref={reading} tabIndex={-1} className="min-w-0 scroll-mt-24 focus:outline-hidden">
      <ConsultationReadingPane
        title={synthesis ? "Sua leitura completa" : section?.title || "Sua leitura"}
        subtitle={referenceDescription || (synthesis ? "Todas as cartas da mesma mesa, conectadas em uma síntese." : chapterHint(spread, chapterId))}
        navigation={navigation}
        card={card}
        note={note}
        revealed={current !== null}
        revealing={revealingPosition === current}
        readingLockedMessage={lockedMessage}
        audio={audioAvailable ? <ReadingAudio key={chapterId} sessionId={session.id} chapter={chapterId} title={section?.title} prepare={narration === true} playbackReady={ready} autoPlay={autoplayChapter === chapterId} onAutoPlayConsumed={() => setAutoplayChapter(null)} /> : null}
        overview={ready ? (
          <div>
            <div className="whitespace-pre-line">{synthesis ? session.aiReading.generalSynthesis : section?.text}</div>
            {synthesis && session.isPaid && !liveInviteDismissed.current && (
              <button
                type="button"
                onClick={() => setShowLiveInvite(true)}
                className="mt-4 min-h-12 rounded-xl border border-cyan-400/50 bg-cyan-950/40 px-5 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-900/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
              >
                Concluir leitura
              </button>
            )}
          </div>
        ) : undefined}
        overviewTitle={synthesis ? "Resumo final" : chapter < physicalRows ? "Leitura da linha" : "Leitura das relações"}
        onPrevious={() => moveCard(-1)}
        onNext={() => moveCard(1)}
        canPrevious={!busy && current !== null && available.indexOf(current) > 0}
        canNext={!busy && current !== null && (available.indexOf(current) < available.length - 1 || current === revealed && revealed < session.cardsDrawn.length)}
        onEnlarge={card && !busy ? () => setEnlargedPosition(card.position) : undefined}
        revealAction={revealed < session.cardsDrawn.length ? <button type="button" disabled={busy} onClick={() => document.getElementById(`oracle-deck-${session.id}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" })} className="min-h-12 rounded-xl border border-amber-300/50 px-4 py-3 text-sm font-semibold text-amber-100 disabled:opacity-50">{busy ? "Revelando sua carta…" : "Voltar ao baralho"}</button> : !synthesis && allReady && spread !== "line3" ? <button type="button" onClick={() => selectChapter(chapters.length)} className="min-h-12 rounded-xl border border-amber-300/50 px-4 text-sm text-amber-100">Ver resumo final</button> : undefined}
        activeView={activeView}
        onViewChange={setActiveView}
      />
      {narration === true && spread !== "line3" && (
        <div hidden={!synthesis || !ready}>
          <ReadingAudio
            key="synthesis"
            sessionId={session.id}
            chapter="synthesis"
            title="Resumo final"
            prepare={narration === true}
            playbackReady={synthesis && ready}
            autoPlay={autoplayChapter === "synthesis"}
            onAutoPlayConsumed={() => setAutoplayChapter(null)}
            onEnded={() => {
              if (session.isPaid && !liveInviteDismissed.current) {
                setShowLiveInvite(true);
              }
            }}
          />
        </div>
      )}
      {allReady && <details id={`oracle-live-${session.id}`} className="mt-6 rounded-2xl border border-cyan-500/30 bg-slate-950/50 p-3"><summary className="cursor-pointer text-sm font-semibold text-cyan-200">Converse sobre sua leitura</summary><div className="mt-3"><LiveConsultation session={session} /></div></details>}
      <div className="flex flex-wrap justify-center gap-5 py-6 text-sm text-slate-400">
        {revealed === session.cardsDrawn.length && <a href={`/api/reading/${session.id}/export`} download className="underline underline-offset-4">Baixar consulta em texto</a>}
        <button type="button" onClick={onReset} className="underline underline-offset-4">Voltar às consultas</button>
      </div>
    </section>
    <CardRevealDialog card={enlargedPosition === null ? null : session.cardsDrawn.find((item) => item.position === enlargedPosition) ?? null} note={allReady ? session.cardNotes?.find((item) => item.position === enlargedPosition)?.text : undefined} onClose={() => setEnlargedPosition(null)} />
    <LiveInviteDialog
      isOpen={showLiveInvite}
      persona={session.persona}
      onAccept={() => {
        setShowLiveInvite(false);
        liveInviteDismissed.current = true;
        const details = document.getElementById(`oracle-live-${session.id}`)?.closest("details");
        if (details) details.open = true;
        document.getElementById(`oracle-live-${session.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        window.dispatchEvent(new CustomEvent("oracle-start-live-conversation", { detail: { sessionId: session.id, requestMic: true } }));
      }}
      onDismiss={() => {
        setShowLiveInvite(false);
        liveInviteDismissed.current = true;
      }}
    />
  </ConsultationWorkspace>;
}

