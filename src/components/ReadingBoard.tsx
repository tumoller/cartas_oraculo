"use client";

import { useEffect, useRef, useState } from "react";
import { useRevealTransition } from "@/lib/reveal-transition";
import { setSoundPreference } from "@/lib/sound-preference";
import type { ReadingSessionPayload } from "@/types";
import { ConsultationReadingPane } from "./ConsultationReadingPane";
import { ConsultationTable } from "./ConsultationTable";
import { ConsultationWorkspace } from "./ConsultationWorkspace";
import { LiveConsultation } from "./LiveConsultation";
import { PixModal } from "./PixModal";
import { ReadingAudio } from "./ReadingAudio";
import { WhatsAppUpsell } from "./WhatsAppUpsell";
import { CardRevealDialog } from "./CardRevealDialog";
import { NarrationChoice } from "./NarrationChoice";
import { LiveInviteDialog } from "./LiveInviteDialog";

const POSITION_NAMES = ["A Raiz / Passado", "O Momento Atual", "O Alerta Oculto", "A Chave de Ação", "O Desfecho & Sorte"];

export function ReadingBoard({ initialSession, onReset, initialNarration }: { initialSession: ReadingSessionPayload; onReset: () => void; initialNarration?: boolean }) {
  const [session, setSession] = useState(initialSession);
  const [revealed, setRevealed] = useState(0);
  const [position, setPosition] = useState(1);
  const [activeView, setActiveView] = useState<"card" | "overview">("card");
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [enlargedPosition, setEnlargedPosition] = useState<number | null>(null);
  const [narration, setNarration] = useState<boolean | null>(initialNarration ?? null);
  const [autoplayChapter, setAutoplayChapter] = useState<string | null>(null);
  const [showLiveInvite, setShowLiveInvite] = useState(false);
  const liveInviteDismissed = useRef(false);
  const previewCompleted = useRef(false);
  const fullCompleted = useRef(false);
  const revealedEvents = useRef(new Set<number>());
  const chapterRef = useRef<HTMLDivElement>(null);
  const overviewOpened = useRef("");
  const revealingPosition = useRevealTransition(session.id);
  const activeCard = session.cardsDrawn[position - 1] ?? null;
  const isVisible = position <= revealed;
  const groupReady = revealed === (session.isPaid ? 5 : 3) && revealingPosition === null;
  const synthesisReady = session.isPaid && groupReady;
  const chapter = activeView === "overview" && synthesisReady ? "synthesis" : "cards";

  useEffect(() => {
    if (revealingPosition !== null || enlargedPosition !== null) return;
    if (!session.isPaid) {
      if (revealed === 3 && !previewCompleted.current) {
        previewCompleted.current = true;
        setActiveView("overview");
      }
      return;
    }
    if (revealed === 5 && !fullCompleted.current) {
      fullCompleted.current = true;
      setActiveView("overview");
      if (narration === true) {
        setAutoplayChapter("synthesis");
      }
    }
  }, [revealed, session.isPaid, enlargedPosition, revealingPosition, narration]);

  const reveal = (next: number) => {
    if (revealingPosition !== null) return;
    if (next < 1 || next > 5) return;
    if (!session.isPaid && next >= 4) { setIsPixModalOpen(true); return; }
    if (next > revealed + 1) return;
    setActiveView("card");
    setPosition(next);
    if (next !== revealed + 1) return;
    setRevealed(next);
    setEnlargedPosition(next);
    if (!revealedEvents.current.has(next)) {
      revealedEvents.current.add(next);
      window.dispatchEvent(new CustomEvent("oracle-reveal", { detail: { sessionId: session.id, position: next, total: session.cardsDrawn.length } }));
    }
  };

  const showChapter = (next: string) => {
    if (next !== "synthesis" || !synthesisReady || enlargedPosition !== null) return;
    setActiveView("overview");
  };

  useEffect(() => {
    const onChapterFocus = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId: string; chapter: string }>).detail;
      if (detail?.sessionId === session.id) showChapter(detail.chapter);
    };
    window.addEventListener("oracle-chapter-focus", onChapterFocus);
    return () => window.removeEventListener("oracle-chapter-focus", onChapterFocus);
  });

  const text = position === 1 ? session.aiReading.card1Reading
    : position === 2 ? session.aiReading.card2Reading
      : position === 3 ? (session.isPaid ? session.aiReading.card3Full || session.aiReading.card3Teaser : session.aiReading.card3Teaser)
        : position === 4 ? session.aiReading.card4Reading : session.aiReading.card5Reading;
  const preview = [session.aiReading.card1Reading, session.aiReading.card2Reading, session.aiReading.card3Teaser].filter(Boolean).join("\n\n");

  const selectFromTable = (next: number) => {
    if (revealingPosition !== null) return;
    if (next === revealed + 1) { reveal(next); return; }
    if (next <= revealed) { setPosition(next); setActiveView("card"); setEnlargedPosition(next); }
  };

  const navigation = <div className="mt-4 max-w-sm">
    <label htmlFor="five-chapter" className="text-xs uppercase tracking-wider text-slate-300">Acompanhar a leitura</label>
    <select id="five-chapter" value={activeView === "overview" ? "overview" : "card" + position} onChange={(event) => {
      setAutoplayChapter(null);
      if (event.target.value === "overview") setActiveView("overview");
      else { setPosition(Number(event.target.value.slice(4))); setActiveView("card"); }
    }} disabled={revealingPosition !== null} className="mt-1 min-h-12 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 text-sm text-slate-100">
      {session.cardsDrawn.map((card) => <option key={card.position} value={"card" + card.position} disabled={card.position > revealed}>Carta {card.position}</option>)}
      <option value="overview" disabled={!groupReady}>{session.isPaid ? "Leitura das cinco cartas" : "Prévia das três cartas"}</option>
    </select>
    <button type="button" onClick={() => { const enabled = narration !== true; setNarration(enabled); setSoundPreference(enabled); }} className="mt-2 min-h-11 text-sm text-amber-200 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">{narration === true ? "Seguir sem narração" : "Ouvir esta leitura"}</button>
  </div>;

  const table = <section className="min-w-0">
    {narration === null && <NarrationChoice onChoose={(enabled) => { setNarration(enabled); setSoundPreference(enabled); }} />}
    <h2 className="mb-3 hidden font-serif text-base text-amber-100 lg:block">Sua mesa · 5 cartas</h2>
    <ConsultationTable cards={session.cardsDrawn} revealed={revealed} current={activeView === "card" ? position : null} highlighted={[]} onSelect={selectFromTable} disabled={revealingPosition !== null} deckId={`oracle-deck-${session.id}`} />
  </section>;

  return <>
    <ConsultationWorkspace session={session} table={table}>
      <div className="space-y-5">
        <div ref={chapterRef} data-reading-chapter={chapter} className="scroll-mt-24">
          <ConsultationReadingPane
            title={"Leitura de " + session.userName}
            subtitle={activeView === "card" ? "Carta " + position + " de 5" + (session.methodVersion === "lenormand-line-v1" ? "" : " · " + POSITION_NAMES[position - 1]) : session.isPaid ? "As cinco cartas da sua mesa" : "As três cartas da sua prévia"}
            navigation={navigation}
            card={activeCard}
            note={isVisible && groupReady ? text ?? undefined : undefined}
            revealed={isVisible}
            revealing={revealingPosition === position}
            readingLockedMessage={`Revele as ${session.isPaid ? "cinco" : "três"} cartas para ler a interpretação.`}
            audio={narration === true && session.isPaid ? <ReadingAudio key="synthesis" sessionId={session.id} chapter="synthesis" title="Leitura das cinco cartas" prepare={narration === true} playbackReady={synthesisReady} autoPlay={autoplayChapter === "synthesis"} onAutoPlayConsumed={() => setAutoplayChapter(null)} onEnded={() => { if (session.isPaid && !liveInviteDismissed.current) setShowLiveInvite(true); }} /> : narration === true && groupReady ? <p className="text-sm text-slate-300">A narração estará disponível ao abrir a leitura completa.</p> : null}
            overview={groupReady ? (
              <div>
                <div className="whitespace-pre-line">{session.isPaid ? session.aiReading.generalSynthesis : preview}</div>
                {session.isPaid && !liveInviteDismissed.current && (
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
            overviewTitle={session.isPaid ? "Leitura das cinco cartas" : "Prévia das três cartas"}
            activeView={activeView}
            onViewChange={setActiveView}
            onPrevious={() => reveal(position - 1)}
            onNext={() => reveal(position + 1)}
            canPrevious={revealingPosition === null && position > 1}
            canNext={revealingPosition === null && position < 5}
            onEnlarge={isVisible ? () => setEnlargedPosition(position) : undefined}
            revealAction={revealingPosition === null && revealed < 5 ? <button type="button" onClick={() => { if (!session.isPaid && revealed === 3) { setIsPixModalOpen(true); return; } document.getElementById(`oracle-deck-${session.id}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }); }} className="min-h-12 rounded-xl border border-amber-300/50 px-5 py-3 text-sm font-semibold text-amber-100">{!session.isPaid && revealed === 3 ? "Abrir leitura completa" : "Voltar ao baralho"}</button> : null}
          />
        </div>
        {synthesisReady && <details id={`oracle-live-${session.id}`} className="rounded-2xl border border-cyan-500/30 bg-slate-950/50 p-3"><summary className="cursor-pointer text-sm font-semibold text-cyan-200">Converse sobre sua leitura</summary><div className="mt-3"><LiveConsultation session={session} /></div></details>}
        {session.isPaid && revealed === 5 && <WhatsAppUpsell session={session} />}
        <button type="button" onClick={onReset} className="mx-auto block min-h-11 text-sm text-slate-300 underline underline-offset-4">Realizar nova leitura</button>
      </div>
    </ConsultationWorkspace>
    <CardRevealDialog card={enlargedPosition === null ? null : session.cardsDrawn[enlargedPosition - 1] ?? null} note={groupReady && enlargedPosition !== null ? (enlargedPosition === 1 ? session.aiReading.card1Reading : enlargedPosition === 2 ? session.aiReading.card2Reading : enlargedPosition === 3 ? session.isPaid ? session.aiReading.card3Full || session.aiReading.card3Teaser : session.aiReading.card3Teaser : enlargedPosition === 4 ? session.aiReading.card4Reading : session.aiReading.card5Reading) ?? undefined : undefined} onClose={() => setEnlargedPosition(null)} />
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
    <PixModal isOpen={isPixModalOpen} onClose={() => setIsPixModalOpen(false)} sessionId={session.id} onSuccess={setSession} />
  </>;
}
