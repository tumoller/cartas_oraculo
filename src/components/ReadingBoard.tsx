"use client";

import "./LivePanel.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRevealTransition } from "@/lib/reveal-transition";
import { setSoundPreference, useSoundPreference } from "@/lib/sound-preference";
import type { ReadingSessionPayload } from "@/types";
import { ConsultationImmersive } from "./ConsultationImmersive";
import { LiveConsultation } from "./LiveConsultation";
import { PaymentModal } from "./PaymentModal";
import { ReadingAudio } from "./ReadingAudio";
import { WhatsAppUpsell } from "./WhatsAppUpsell";
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

export function ReadingBoard({
  initialSession,
  onReset,
  initialNarration,
}: {
  initialSession: ReadingSessionPayload;
  onReset: () => void;
  initialNarration?: boolean;
}) {
  const soundPref = useSoundPreference();
  const [session, setSession] = useState(initialSession);
  const [revealed, setRevealed] = useState(0);
  const [position, setPosition] = useState(1);
  const [activeView, setActiveView] = useState<"card" | "overview">("card");
  // Voltou da página de pagamento com um pagamento em andamento: reabre para mostrar a confirmação.
  const [isPixModalOpen, setIsPixModalOpen] = useState(() => {
    try { return !initialSession.isPaid && Boolean(localStorage.getItem(`oracle_payment_${initialSession.id}`)); } catch { return false; }
  });
  const [enlargedPosition, setEnlargedPosition] = useState<number | null>(null);
  const [narration, setNarration] = useState<boolean | null>(initialNarration ?? null);
  const [autoplayChapter, setAutoplayChapter] = useState<string | null>(null);
  const [showLiveInvite, setShowLiveInvite] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{
    mode: "playing" | "unheard";
    targetView: "card" | "overview";
    targetPosition?: number;
    openEnlarge?: boolean;
    previousTime: number;
    media: HTMLAudioElement | null;
  } | null>(null);
  const [liveInviteDismissed, setLiveInviteDismissed] = useState(false);

  useEffect(() => {
    if (narration === null && soundPref !== null) {
      // Restore saved sound preference when opening saved readings.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNarration(soundPref);
    }
  }, [narration, soundPref]);

  const previewCompleted = useRef(false);
  const fullCompleted = useRef(false);
  const revealedEvents = useRef(new Set<number>());
  const revealingPosition = useRevealTransition(session.id);
  const groupReady = revealed === (session.isPaid ? 5 : 3) && revealingPosition === null;
  const synthesisReady = session.isPaid && groupReady;
  const effectiveNarration = narration ?? soundPref;

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
      if (effectiveNarration === true) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAutoplayChapter("synthesis");
      }
    }
  }, [revealed, session.isPaid, enlargedPosition, revealingPosition, effectiveNarration]);

  const reveal = (next: number) => {
    if (revealingPosition !== null) return;
    if (next < 1 || next > 5) return;
    if (!session.isPaid && next >= 4) {
      setIsPixModalOpen(true);
      return;
    }
    if (next > revealed + 1) return;
    setActiveView("card");
    setPosition(next);
    if (next !== revealed + 1) return;
    setRevealed(next);
    if (!revealedEvents.current.has(next)) {
      revealedEvents.current.add(next);
      window.dispatchEvent(
        new CustomEvent("oracle-reveal", { detail: { sessionId: session.id, position: next, total: session.cardsDrawn.length } })
      );
    }
  };

  const showChapter = useCallback((next: string) => {
    if (next !== "synthesis" || !synthesisReady || enlargedPosition !== null || activeView === "overview") return;
    setActiveView("overview");
  }, [synthesisReady, enlargedPosition, activeView]);

  useEffect(() => {
    const onChapterFocus = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId: string; chapter: string }>).detail;
      if (detail?.sessionId === session.id) showChapter(detail.chapter);
    };
    const onTestInvite = () => setShowLiveInvite(true);
    const onUnlock = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId: string }>).detail;
      if (!detail?.sessionId || detail.sessionId === session.id) {
        setSession((prev) => ({ ...prev, isPaid: true }));
      }
    };
    window.addEventListener("oracle-chapter-focus", onChapterFocus);
    window.addEventListener("oracle-test-show-invite", onTestInvite);
    window.addEventListener("oracle-test-unlock", onUnlock);
    return () => {
      window.removeEventListener("oracle-chapter-focus", onChapterFocus);
      window.removeEventListener("oracle-test-show-invite", onTestInvite);
      window.removeEventListener("oracle-test-unlock", onUnlock);
    };
  }, [session.id, showChapter]);

  const text =
    position === 1
      ? session.aiReading.card1Reading
      : position === 2
        ? session.aiReading.card2Reading
        : position === 3
          ? session.isPaid
            ? session.aiReading.card3Full || session.aiReading.card3Teaser
            : session.aiReading.card3Teaser
          : position === 4
            ? session.aiReading.card4Reading
            : session.aiReading.card5Reading;
  const preview = [session.aiReading.card1Reading, session.aiReading.card2Reading, session.aiReading.card3Teaser].filter(Boolean).join("\n\n");

  const confirmChapterSwitch = () => {
    if (!pendingNavigation) return;
    const { mode, targetView, targetPosition, openEnlarge, previousTime } = pendingNavigation;
    if (mode === "playing") {
      saveChapterTime(session.id, "synthesis", previousTime);
    } else {
      setAutoplayChapter(null);
    }
    setPendingNavigation(null);
    setActiveView(targetView);
    if (targetPosition !== undefined) {
      setPosition(targetPosition);
      if (openEnlarge) setEnlargedPosition(targetPosition);
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

  const selectFromTable = (next: number) => {
    if (revealingPosition !== null) return;
    if (next === revealed + 1) {
      reveal(next);
      return;
    }
    if (next <= revealed) {
      setEnlargedPosition(next);
    }
  };

  const handleNavigationSelect = (value: string) => {
    const targetView = value === "overview" ? "overview" : "card";
    const targetPos = value === "overview" ? undefined : Number(value.slice(4));

    const isSame =
      (targetView === "overview" && activeView === "overview") ||
      (targetView === "card" && activeView === "card" && targetPos === position);
    if (isSame) return;

    if (activeView === "overview" && targetView === "card" && effectiveNarration === true) {
      if (isAudioPlaying()) {
        const playing = getCurrentPlayingMedia();
        const pausedTime = playing?.currentTime ?? 0;
        playing?.pause();
        setPendingNavigation({
          mode: "playing",
          targetView,
          targetPosition: targetPos,
          previousTime: pausedTime,
          media: playing,
        });
        return;
      }
      const state = getChapterAudioState(session.id, "synthesis");
      const isPreparing = state.status === "pending" || state.status === "generating";
      const isReadyUnheard = state.status === "ready" && !state.hasPlayed && !state.userPaused;
      if (isPreparing || isReadyUnheard) {
        setPendingNavigation({
          mode: "unheard",
          targetView,
          targetPosition: targetPos,
          previousTime: 0,
          media: null,
        });
        return;
      }
    }

    setAutoplayChapter(null);
    if (targetView === "overview") {
      setActiveView("overview");
    } else if (targetPos !== undefined) {
      setPosition(targetPos);
      setActiveView("card");
    }
  };

  return (
    <>
        <ConsultationImmersive
          session={session}
          revealed={revealed}
          onRevealNext={() => reveal(revealed + 1)}
          chapter={activeView === "overview" ? 1 : 0}
          chapters={[
            { id: "cards", title: "As cartas da sua mesa" },
            { id: "synthesis", title: session.isPaid ? "Leitura das cinco cartas" : "Prévia das três cartas" },
          ]}
          onSelectChapter={(idx) => handleNavigationSelect(idx === 1 ? "overview" : "card1")}
          current={position}
          highlightedPositions={activeView === "overview" ? [1, 2, 3, 4, 5].slice(0, session.isPaid ? 5 : 3) : [position]}
          onSelectCard={selectFromTable}
          chapterText={groupReady ? (session.isPaid ? session.aiReading.generalSynthesis : preview) : null}
          cardNote={text ?? undefined}
          narrationReady={synthesisReady}
          onStartNarration={() => {
            setSoundPreference(true);
            setNarration(true);
            setAutoplayChapter("synthesis");
          }}
          busy={revealingPosition !== null}
          onRequestUnlock={!session.isPaid && revealed === 3 ? () => setIsPixModalOpen(true) : undefined}
          onReset={onReset}
          extras={session.isPaid && revealed === 5 ? <WhatsAppUpsell session={session} /> : undefined}
        />

        {/* Mounted for every paid reading so a play tap is never missed; generation still waits for `prepare` or an explicit request. */}
        {session.isPaid && (
          <ReadingAudio
            key="synthesis"
            headless
            sessionId={session.id}
            chapter="synthesis"
            title="Leitura das cinco cartas"
            persona={session.persona}
            lineLabel="Leitura das cinco cartas"
            chapterText={synthesisReady ? session.aiReading.generalSynthesis ?? undefined : undefined}
            prepare={session.isPaid && effectiveNarration === true && synthesisReady}
            playbackReady={synthesisReady}
            autoPlay={autoplayChapter === "synthesis"}
            onAutoPlayConsumed={() => setAutoplayChapter(null)}
            onEnded={() => {
              if (session.isPaid && !liveInviteDismissed) setShowLiveInvite(true);
            }}
          />
        )}

      {synthesisReady && (
        <details id={`oracle-live-${session.id}`} className="oracle-live-panel oracle-live-immersive">
          <summary>Converse sobre sua leitura</summary>
          <LiveConsultation session={session} immersive />
        </details>
      )}

      <CardRevealDialog
        card={enlargedPosition === null ? null : session.cardsDrawn[enlargedPosition - 1] ?? null}
        note={
          groupReady && enlargedPosition !== null
            ? (enlargedPosition === 1
                ? session.aiReading.card1Reading
                : enlargedPosition === 2
                  ? session.aiReading.card2Reading
                  : enlargedPosition === 3
                    ? session.isPaid
                      ? session.aiReading.card3Full || session.aiReading.card3Teaser
                      : session.aiReading.card3Teaser
                    : enlargedPosition === 4
                      ? session.aiReading.card4Reading
                      : session.aiReading.card5Reading) ?? undefined
            : undefined
        }
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
      <PaymentModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        persona={session.persona}
        kind="unlock"
        readingId={session.id}
        spread="line5"
        onPaid={async () => {
          // O servidor já marcou a leitura como paga; recarrega o conteúdo completo.
          const response = await fetch(`/api/reading/${session.id}`, { cache: "no-store" });
          if (response.ok) setSession(await response.json());
          try { localStorage.removeItem(`oracle_payment_${session.id}`); } catch {}
          setIsPixModalOpen(false);
        }}
      />
    </>
  );
}
