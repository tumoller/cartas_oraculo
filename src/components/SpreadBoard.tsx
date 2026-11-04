"use client";

import "./LivePanel.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReadingSessionPayload } from "@/types";
import { setSoundPreference, useSoundPreference } from "@/lib/sound-preference";
import { canReadChapter, presentationSections, themeFocusId } from "@/lib/reading-chapters";
import { useRevealTransition } from "@/lib/reveal-transition";
import { ConsultationImmersive } from "./ConsultationImmersive";
import { ReadingAudio } from "./ReadingAudio";
import { LiveConsultation } from "./LiveConsultation";
import { CardRevealDialog } from "./CardRevealDialog";
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
  const [enlargedPosition, setEnlargedPosition] = useState<number | null>(null);
  const [narration, setNarration] = useState<boolean | null>(initialNarration ?? null);
  const [autoplayChapter, setAutoplayChapter] = useState<string | null>(null);
  const [showLiveInvite, setShowLiveInvite] = useState(false);

  useEffect(() => {
    if (narration === null && soundPref !== null) {
      // Restore saved sound preference when opening saved readings.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNarration(soundPref);
    }
  }, [narration, soundPref]);

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
  const current = selected !== null && available.includes(selected) ? selected : available[0] ?? null;
  const note = allReady ? session.cardNotes?.find((item) => item.position === current)?.text : undefined;
  const effectiveNarration = narration ?? soundPref;
  const audioAvailable = effectiveNarration === true;
  const isEarlyRowSpread =
    (spread === "grand36" && session.methodVersion === "lenormand-grand36-v2") ||
    (spread === "box9" && session.methodVersion === "lenormand-box9-v2");
  const applySelectChapter = useCallback((index: number) => {
    setAutoplayChapter(null);
    setChapter(index);
    const target = index === chapters.length ? session.cardsDrawn.map((item) => item.position) : chapters[index]?.positions || [];
    setSelected(
      chapters[index]?.id === "section5" && spread === "grand36" && themeCard && target.includes(themeCard.position)
        ? themeCard.position
        : target.find((position) => position <= revealed) ?? null
    );
  }, [chapters, revealed, session.cardsDrawn, spread, themeCard]);

  const requestChapterSwitch = useCallback((
    type: "manual" | "row-completion",
    targetIndex: number,
    targetChapterId: string
  ) => {
    if (busy) return;

    if (type === "row-completion") {
      if (targetIndex === chapter) {
        if (effectiveNarration === true) {
          setAutoplayChapter(targetChapterId);
        }
        return;
      }
    } else {
      if (targetIndex === chapter) return;
    }

    if (effectiveNarration !== true) {
      if (type === "row-completion") {
        setChapter(targetIndex);
      } else {
        applySelectChapter(targetIndex);
      }
      return;
    }

    if (isAudioPlaying()) {
      const playing = getCurrentPlayingMedia();
      const pausedTime = playing?.currentTime ?? 0;
      playing?.pause();
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
      if (effectiveNarration === true) {
        setAutoplayChapter(targetChapterId);
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
    setPendingNavigation(null);
    if (type === "row-completion") {
      setChapter(targetIndex);
      if (effectiveNarration === true) {
        setAutoplayChapter(targetChapterId);
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

  return (
    <>
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
          narrationReady={ready && session.isPaid}
          onStartNarration={() => {
            setSoundPreference(true);
            setNarration(true);
            setAutoplayChapter(chapterId);
          }}
          busy={busy}
          onReset={onReset}
          extras={
            revealed === session.cardsDrawn.length ? (
              <a href={`/api/reading/${session.id}/export`} download className="underline underline-offset-4">
                Baixar consulta em texto
              </a>
            ) : undefined
          }
        />

        {audioAvailable && (
          <ReadingAudio
            key={chapterId}
            headless
            sessionId={session.id}
            chapter={chapterId}
            title={synthesis ? "Resumo final" : section?.title}
            persona={session.persona}
            lineLabel={synthesis ? "Resumo final" : section?.title || "Leitura da linha"}
            chapterText={chapterUnlocked ? (synthesis ? session.aiReading.generalSynthesis : section?.text) ?? undefined : undefined}
            prepare={session.isPaid && effectiveNarration === true && chapterUnlocked}
            playbackReady={chapterUnlocked}
            autoPlay={autoplayChapter === chapterId}
            onAutoPlayConsumed={() => setAutoplayChapter(null)}
            onEnded={() => {
              if (isFinalChapter && session.isPaid && !liveInviteDismissed) {
                setShowLiveInvite(true);
              }
            }}
          />
        )}

      {allReady && (
        <details id={`oracle-live-${session.id}`} className="oracle-live-panel oracle-live-immersive">
          <summary>Converse sobre sua leitura</summary>
          <LiveConsultation session={session} immersive />
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
