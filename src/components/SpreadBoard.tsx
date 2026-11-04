"use client";

import "./LivePanel.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReadingSessionPayload } from "@/types";
import { setSoundPreference, useSoundPreference } from "@/lib/sound-preference";
import { canReadChapter, chapterHint, presentationSections, themeFocusId } from "@/lib/reading-chapters";
import { useRevealTransition } from "@/lib/reveal-transition";
import { ConsultationWorkspace } from "./ConsultationWorkspace";
import { ConsultationTable } from "./ConsultationTable";
import { ConsultationReadingPane } from "./ConsultationReadingPane";
import { ConsultationImmersive } from "./ConsultationImmersive";
import { ReadingAudio } from "./ReadingAudio";
import { LiveConsultation } from "./LiveConsultation";
import { CardRevealDialog } from "./CardRevealDialog";
import { NarrationChoice } from "./NarrationChoice";
import { LiveInviteDialog } from "./LiveInviteDialog";
import { ChapterSwitchDialog } from "./ChapterSwitchDialog";
import {
  getChapterAudioState,
  getCurrentPlayingMedia,
  isAudioPlaying,
  pauseCurrentVoice,
  resumePlayingMedia,
  saveChapterTime,
} from "@/lib/consultation-audio";

export function SpreadBoard({
  session,
  onReset,
  initialNarration,
}: {
  session: ReadingSessionPayload;
  onReset: () => void;
  initialNarration?: boolean;
}) {
  const soundPref = useSoundPreference();
  const [chapter, setChapter] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<"card" | "overview">("card");
  const [enlargedPosition, setEnlargedPosition] = useState<number | null>(null);
  const [narration, setNarration] = useState<boolean | null>(initialNarration ?? null);
  const [autoplayChapter, setAutoplayChapter] = useState<string | null>(null);
  const [showPresentation, setShowPresentation] = useState(false);
  const [presentationChapter, setPresentationChapter] = useState<string | null>(null);
  const [showLiveInvite, setShowLiveInvite] = useState(false);
  const [viewMode, setViewMode] = useState<"normal" | "immersive">("immersive");

  useEffect(() => {
    if (narration === null && soundPref !== null) {
      // Restore saved sound preference when opening saved readings.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNarration(soundPref);
    }
  }, [narration, soundPref]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("oracle_view_mode");
      // Restore browser preference after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "normal" || saved === "immersive") setViewMode(saved);
    } catch {}
  }, []);

  const togglePresentation = useCallback(() => {
    setViewMode((curr) => {
      const next = curr === "normal" ? "immersive" : "normal";
      try { localStorage.setItem("oracle_view_mode", next); } catch {}
      return next;
    });
  }, []);

  const [pendingNavigation, setPendingNavigation] = useState<{
    mode: "playing" | "unheard";
    type: "manual" | "row-completion";
    targetIndex: number;
    targetChapterId: string;
    previousChapterId: string;
    previousTime: number;
    media: HTMLAudioElement | null;
  } | null>(null);
  const [liveInviteDismissed, setLiveInviteDismissed] = useState(false);
  const consumedCompletions = useRef(new Set<number>());
  const reading = useRef<HTMLElement>(null);
  const spread = session.spread || "line3";
  const chapters = useMemo(() => presentationSections(spread, session.sections || []), [spread, session.sections]);
  const revealingPosition = useRevealTransition(session.id);
  const busy = revealingPosition !== null;
  const physicalRows = spread === "grand36" ? 4 : spread === "box9" ? 3 : 1;
  const synthesis = chapter === chapters.length;
  const section = chapters[chapter];
  const positions = synthesis ? session.cardsDrawn.map((item) => item.position) : section?.positions || [];
  const available = positions.filter((position) => position <= revealed);
  const chapterId = synthesis ? "synthesis" : section?.id || "section1";
  const chapterUnlocked = canReadChapter(spread, chapterId, positions, revealed, session.cardsDrawn.length, session.methodVersion);
  const ready = !busy && chapterUnlocked;
  const allReady = !busy && revealed === session.cardsDrawn.length;
  const isFinalChapter = synthesis || (spread === "line3" && allReady);
  const themeCard = spread === "grand36" && allReady ? session.cardsDrawn.find((item) => item.id === themeFocusId(session.theme)) : undefined;
  const reference = chapterId === "section5" && themeCard && positions.includes(themeCard.position) ? themeCard : undefined;
  const referenceDescription = reference
    ? `Carta do tema: ${reference.name?.replace(/^\d+\.\s*/, "")} · posição ${reference.position}. Este recorte tem ${positions.length} cartas${positions.length < 9 ? "; nas bordas e nos cantos, há menos vizinhas" : ", incluindo a referência e suas oito vizinhas"}.`
    : undefined;
  const current = selected !== null && available.includes(selected) ? selected : available[0] ?? null;
  const card = current === null ? null : session.cardsDrawn.find((item) => item.position === current) ?? null;
  const note = allReady ? session.cardNotes?.find((item) => item.position === current)?.text : undefined;
  const effectiveNarration = narration ?? soundPref;
  const audioAvailable = effectiveNarration === true;
  const isEarlyRowSpread =
    (spread === "grand36" && session.methodVersion === "lenormand-grand36-v2") ||
    (spread === "box9" && session.methodVersion === "lenormand-box9-v2");
  const lockedMessage = allReady
    ? undefined
    : ready
      ? "A leitura desta linha está pronta na opção Leitura da linha. Os textos individuais, que podem cruzar outras linhas, serão liberados ao completar a mesa."
      : isEarlyRowSpread && chapter < physicalRows
        ? `Revele as ${spread === "grand36" ? "nove" : "três"} cartas desta linha. A interpretação será apresentada em seguida.`
        : "Primeiro revele todas as cartas da mesa. Depois, explore as interpretações e as relações entre elas.";

  const focusReadingOnMobile = () => {
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    window.requestAnimationFrame(() => {
      reading.current?.focus({ preventScroll: true });
      reading.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  const applySelectChapter = useCallback((index: number) => {
    setAutoplayChapter(null);
    setShowPresentation(false);
    setPresentationChapter(null);
    setChapter(index);
    const target = index === chapters.length ? session.cardsDrawn.map((item) => item.position) : chapters[index]?.positions || [];
    setSelected(
      chapters[index]?.id === "section5" && spread === "grand36" && themeCard && target.includes(themeCard.position)
        ? themeCard.position
        : target.find((position) => position <= revealed) ?? null
    );
    setActiveView(
      index >= physicalRows || canReadChapter(spread, chapters[index]?.id || "", target, revealed, session.cardsDrawn.length, session.methodVersion)
        ? "overview"
        : "card"
    );
    focusReadingOnMobile();
  }, [chapters, physicalRows, revealed, session.cardsDrawn, session.methodVersion, spread, themeCard]);

  const requestChapterSwitch = useCallback((
    type: "manual" | "row-completion",
    targetIndex: number,
    targetChapterId: string
  ) => {
    if (busy) return;

    if (type === "row-completion") {
      if (targetIndex === chapter) {
        setActiveView("overview");
        if (effectiveNarration === true) {
          setAutoplayChapter(targetChapterId);
          setShowPresentation(true);
          setPresentationChapter(targetChapterId);
        }
        return;
      }
    } else {
      if (targetIndex === chapter) return;
    }

    if (effectiveNarration !== true) {
      if (type === "row-completion") {
        setChapter(targetIndex);
        setActiveView("overview");
      } else {
        applySelectChapter(targetIndex);
      }
      return;
    }

    if (isAudioPlaying()) {
      const playing = getCurrentPlayingMedia();
      const pausedTime = playing?.currentTime ?? 0;
      playing?.pause();
      setShowPresentation(false);
      setPresentationChapter(null);
      setPendingNavigation({
        mode: "playing",
        type,
        targetIndex,
        targetChapterId,
        previousChapterId: chapterId,
        previousTime: pausedTime,
        media: playing,
      });
      return;
    }

    const state = getChapterAudioState(session.id, chapterId);
    const isPreparing = state.status === "pending" || state.status === "generating";
    const isReadyUnheard = state.status === "ready" && !state.hasPlayed && !state.userPaused;

    if (isPreparing || isReadyUnheard) {
      setShowPresentation(false);
      setPresentationChapter(null);
      setPendingNavigation({
        mode: "unheard",
        type,
        targetIndex,
        targetChapterId,
        previousChapterId: chapterId,
        previousTime: 0,
        media: null,
      });
      return;
    }

    if (type === "row-completion") {
      setChapter(targetIndex);
      setActiveView("overview");
      if (effectiveNarration === true) {
        setAutoplayChapter(targetChapterId);
        setShowPresentation(true);
        setPresentationChapter(targetChapterId);
      }
    } else {
      applySelectChapter(targetIndex);
    }
  }, [applySelectChapter, busy, chapter, chapterId, effectiveNarration, session.id]);

  const confirmChapterSwitch = () => {
    if (!pendingNavigation) return;
    const { mode, type, targetIndex, targetChapterId, previousChapterId, previousTime } = pendingNavigation;
    if (mode === "playing") {
      saveChapterTime(session.id, previousChapterId, previousTime);
    } else {
      setAutoplayChapter(null);
    }
    setShowPresentation(false);
    setPresentationChapter(null);
    setPendingNavigation(null);
    if (type === "row-completion") {
      setChapter(targetIndex);
      setActiveView("overview");
      if (effectiveNarration === true) {
        setAutoplayChapter(targetChapterId);
        setShowPresentation(true);
        setPresentationChapter(targetChapterId);
      }
    } else {
      applySelectChapter(targetIndex);
    }
  };

  const cancelChapterSwitch = () => {
    if (!pendingNavigation) return;
    const { mode, media } = pendingNavigation;
    setPendingNavigation(null);
    if (mode === "playing") {
      void resumePlayingMedia(media);
    }
  };

  useEffect(() => {
    if (busy || enlargedPosition !== null) return;
    for (let r = 0; r < physicalRows; r++) {
      const rowId = chapters[r]?.id || "";
      const rowPositions = chapters[r]?.positions || [];
      const rowComplete = rowPositions.length > 0 && rowPositions.every((pos) => pos <= revealed);
      const rowCanRead = canReadChapter(spread, rowId, rowPositions, revealed, session.cardsDrawn.length, session.methodVersion);
      if (rowComplete && rowCanRead && !consumedCompletions.current.has(r)) {
        consumedCompletions.current.add(r);
        if (isEarlyRowSpread) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          requestChapterSwitch("row-completion", r, rowId);
          break;
        }
      }
    }
  }, [
    busy,
    enlargedPosition,
    physicalRows,
    chapters,
    revealed,
    spread,
    session.cardsDrawn.length,
    session.methodVersion,
    isEarlyRowSpread,
    requestChapterSwitch,
  ]);

  useEffect(() => {
    const onChapterFocus = (event: Event) => {
      const { sessionId, chapter: id } = (event as CustomEvent<{ sessionId: string; chapter: string }>).detail || {};
      if (sessionId !== session.id) return;
      const index = id === "synthesis" ? chapters.length : chapters.findIndex((item) => item.id === id);
      if (index < 0 || index === chapter) return;
      const target = index === chapters.length ? session.cardsDrawn.map((item) => item.position) : chapters[index].positions;
      if (busy || enlargedPosition !== null || !canReadChapter(spread, id, target, revealed, session.cardsDrawn.length, session.methodVersion))
        return;
      setChapter(index);
      setSelected(target[0] ?? null);
      setActiveView("overview");
    };
    const onTestInvite = () => setShowLiveInvite(true);
    window.addEventListener("oracle-chapter-focus", onChapterFocus);
    window.addEventListener("oracle-test-show-invite", onTestInvite);
    return () => {
      window.removeEventListener("oracle-chapter-focus", onChapterFocus);
      window.removeEventListener("oracle-test-show-invite", onTestInvite);
    };
  }, [session.id, session.cardsDrawn, session.methodVersion, chapters, revealed, busy, spread, enlargedPosition, chapter]);

  const revealNext = () => {
    if (busy || revealed >= session.cardsDrawn.length) return;
    const position = revealed + 1;
    setRevealed(position);
    setSelected(position);
    setActiveView("card");
    setEnlargedPosition(position);
    window.dispatchEvent(
      new CustomEvent("oracle-reveal", {
        detail: { sessionId: session.id, position, total: session.cardsDrawn.length },
      })
    );
  };

  const showCard = (position: number) => {
    if (busy) return;
    if (position === revealed + 1) {
      revealNext();
      return;
    }
    if (position > revealed) return;
    setEnlargedPosition(position);
  };

  const selectChapter = (index: number) => {
    if (busy || index === chapter) return;
    const targetChapterId = index === chapters.length ? "synthesis" : chapters[index]?.id || "";
    requestChapterSwitch("manual", index, targetChapterId);
  };

  const moveCard = (step: number) => {
    if (busy || current === null) return;
    const next = available[available.indexOf(current) + step];
    if (next !== undefined) setSelected(next);
    else if (step > 0 && current === revealed && revealed < session.cardsDrawn.length) revealNext();
  };

  const navigation = (
    <div className="mt-4 max-w-sm">
      <label htmlFor="spread-chapter" className="text-xs uppercase tracking-wider text-slate-300">
        Acompanhar a leitura
      </label>
      <select
        id="spread-chapter"
        value={chapter}
        disabled={busy}
        onChange={(event) => selectChapter(Number(event.target.value))}
        className="mt-1 min-h-12 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 text-sm text-slate-100"
      >
        {chapters.map((item, index) => (
          <option key={item.id} value={index}>
            {index + 1}. {item.title}
          </option>
        ))}
        {spread !== "line3" && <option value={chapters.length}>Resumo final</option>}
      </select>
      <button
        type="button"
        onClick={() => {
          const enabled = effectiveNarration !== true;
          setNarration(enabled);
          setSoundPreference(enabled);
        }}
        className="mt-2 min-h-11 text-sm text-amber-200 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
      >
        {effectiveNarration === true ? "Seguir sem narração" : "Ouvir esta leitura"}
      </button>
    </div>
  );

  const table = (
    <section className="min-w-0">
      {effectiveNarration === null && (
        <NarrationChoice
          onChoose={(enabled) => {
            setNarration(enabled);
            setSoundPreference(enabled);
          }}
        />
      )}
      <h2 className="mb-3 hidden font-serif text-base text-amber-100 lg:block">
        Sua mesa · {session.cardsDrawn.length} cartas
      </h2>
      {referenceDescription && (
        <p role="note" className="mb-3 text-sm leading-relaxed text-cyan-100">
          {referenceDescription}
        </p>
      )}
      <ConsultationTable
        cards={session.cardsDrawn}
        revealed={revealed}
        current={current}
        highlighted={positions}
        onSelect={showCard}
        disabled={busy}
        mobilePositions={spread === "grand36" && chapter < physicalRows ? positions : undefined}
        mobileLabel={
          spread === "grand36" && chapter < physicalRows
            ? `${section?.title} · ${available.length} de ${positions.length} cartas`
            : undefined
        }
        deckId={`oracle-deck-${session.id}`}
        referencePosition={reference?.position}
      />
      {spread === "grand36" && synthesis && (
        <nav aria-label="Aproximar uma linha da mesa" className="mt-3 grid grid-cols-2 gap-2 lg:hidden">
          {Array.from({ length: 4 }, (_, index) => (
            <button
              type="button"
              key={index}
              onClick={() => selectChapter(index)}
              className="min-h-12 rounded-xl border border-amber-200/40 px-3 text-sm text-amber-100"
            >
              Ver linha {index + 1}
            </button>
          ))}
        </nav>
      )}
    </section>
  );

  return (
    <>
      <div className="w-full" style={{ display: viewMode === "normal" ? "block" : "none" }}>
        <ConsultationWorkspace
          session={session}
          table={table}
          onToggleImmersive={togglePresentation}
        >
          <section ref={reading} tabIndex={-1} className="min-w-0 scroll-mt-24 focus:outline-hidden">
            <ConsultationReadingPane
              title={synthesis ? "Sua leitura completa" : section?.title || "Sua leitura"}
              subtitle={
                referenceDescription ||
                (synthesis ? "Todas as cartas da mesma mesa, conectadas em uma síntese." : chapterHint(spread, chapterId))
              }
              navigation={navigation}
              card={card}
              note={note}
              revealed={current !== null}
              revealing={revealingPosition === current}
              readingLockedMessage={lockedMessage}
              audio={
                audioAvailable ? (
                  <ReadingAudio
                    key={chapterId}
                    sessionId={session.id}
                    chapter={chapterId}
                    title={synthesis ? "Resumo final" : section?.title}
                    persona={session.persona}
                    lineLabel={synthesis ? "Resumo final" : section?.title || "Leitura da linha"}
                    chapterText={chapterUnlocked ? (synthesis ? session.aiReading.generalSynthesis : section?.text) ?? undefined : undefined}
                    prepare={session.isPaid && effectiveNarration === true && chapterUnlocked}
                    playbackReady={chapterUnlocked}
                    autoPlay={autoplayChapter === chapterId}
                    showPresentation={showPresentation && presentationChapter === chapterId}
                    onOpenPresentation={() => {
                      setPresentationChapter(chapterId);
                      setShowPresentation(true);
                    }}
                    onDismissPresentation={() => {
                      setShowPresentation(false);
                      setPresentationChapter(null);
                    }}
                    onAutoPlayConsumed={() => setAutoplayChapter(null)}
                    onEnded={() => {
                      setShowPresentation(false);
                      setPresentationChapter(null);
                      if (isFinalChapter && session.isPaid && !liveInviteDismissed) {
                        setShowLiveInvite(true);
                      }
                    }}
                  />
                ) : null
              }
              overview={
                ready ? (
                  <div>
                    <div className="whitespace-pre-line">
                      {synthesis ? session.aiReading.generalSynthesis : section?.text}
                    </div>
                    {isFinalChapter && session.isPaid && !liveInviteDismissed && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowPresentation(false);
                          setPresentationChapter(null);
                          setShowLiveInvite(true);
                        }}
                        className="mt-4 min-h-12 rounded-xl border border-cyan-400/50 bg-cyan-950/40 px-5 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-900/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
                      >
                        Concluir leitura
                      </button>
                    )}
                  </div>
                ) : undefined
              }
              overviewTitle={synthesis ? "Resumo final" : chapter < physicalRows ? "Leitura da linha" : "Leitura das relações"}
              onPrevious={() => moveCard(-1)}
              onNext={() => moveCard(1)}
              canPrevious={!busy && current !== null && available.indexOf(current) > 0}
              canNext={
                !busy &&
                current !== null &&
                (available.indexOf(current) < available.length - 1 || (current === revealed && revealed < session.cardsDrawn.length))
              }
              onEnlarge={card && !busy ? () => setEnlargedPosition(card.position) : undefined}
              revealAction={
                revealed < session.cardsDrawn.length ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      document.getElementById(`oracle-deck-${session.id}`)?.scrollIntoView({
                        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                        block: "center",
                      })
                    }
                    className="min-h-12 rounded-xl border border-amber-300/50 px-4 py-3 text-sm font-semibold text-amber-100 disabled:opacity-50"
                  >
                    {busy ? "Revelando sua carta…" : "Voltar ao baralho"}
                  </button>
                ) : !synthesis && allReady && spread !== "line3" ? (
                  <button
                    type="button"
                    onClick={() => selectChapter(chapters.length)}
                    className="min-h-12 rounded-xl border border-amber-300/50 px-4 text-sm text-amber-100"
                  >
                    Ver resumo final
                  </button>
                ) : undefined
              }
              activeView={activeView}
              onViewChange={setActiveView}
            />

            <div className="flex flex-wrap justify-center gap-5 py-6 text-sm text-slate-400">
              {revealed === session.cardsDrawn.length && (
                <a href={`/api/reading/${session.id}/export`} download className="underline underline-offset-4">
                  Baixar consulta em texto
                </a>
              )}
              <button type="button" onClick={onReset} className="underline underline-offset-4">
                Voltar às consultas
              </button>
            </div>
          </section>
        </ConsultationWorkspace>
      </div>

      <div className="w-full" style={{ display: viewMode === "immersive" ? "block" : "none" }}>
        <ConsultationImmersive
          session={session}
          revealed={revealed}
          onRevealNext={revealNext}
          chapter={chapter}
          chapters={chapters}
          onSelectChapter={selectChapter}
          current={current}
          highlightedPositions={positions}
          onSelectCard={showCard}
          chapterText={chapterUnlocked ? (synthesis ? session.aiReading.generalSynthesis : section?.text) : null}
          cardNote={note}
          onTogglePresentation={togglePresentation}
          narrationReady={ready && session.isPaid}
          onStartNarration={() => {
            setSoundPreference(true);
            setNarration(true);
            setAutoplayChapter(chapterId);
          }}
          busy={busy}
        />
      </div>

      {allReady && (
        <details id={`oracle-live-${session.id}`} className={`oracle-live-panel ${viewMode === "immersive" ? "oracle-live-immersive" : ""}`}>
          <summary>Converse sobre sua leitura</summary>
          <LiveConsultation session={session} immersive={viewMode === "immersive"} />
        </details>
      )}

      <CardRevealDialog
        card={enlargedPosition === null ? null : session.cardsDrawn.find((item) => item.position === enlargedPosition) ?? null}
        note={allReady ? session.cardNotes?.find((item) => item.position === enlargedPosition)?.text : undefined}
        onClose={() => setEnlargedPosition(null)}
      />
      <LiveInviteDialog
        isOpen={showLiveInvite}
        persona={session.persona}
        onAccept={() => {
          pauseCurrentVoice();
          setShowLiveInvite(false);
          setLiveInviteDismissed(true);
          const details = document.getElementById(`oracle-live-${session.id}`)?.closest("details");
          if (details) details.open = true;
          document.getElementById(`oracle-live-${session.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
          window.dispatchEvent(
            new CustomEvent("oracle-start-live-conversation", {
              detail: { sessionId: session.id, requestMic: true },
            })
          );
        }}
        onDismiss={() => {
          pauseCurrentVoice();
          setShowLiveInvite(false);
          setLiveInviteDismissed(true);
          window.requestAnimationFrame(() => {
            reading.current?.focus({ preventScroll: true });
          });
        }}
      />
      <ChapterSwitchDialog
        isOpen={Boolean(pendingNavigation)}
        mode={pendingNavigation?.mode}
        onConfirm={confirmChapterSwitch}
        onCancel={cancelChapterSwitch}
      />
    </>
  );
}
