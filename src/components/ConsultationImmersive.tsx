"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ReadingSessionPayload } from "@/types";
import { sceneAssets } from "@/lib/scene-assets";
import { setSoundPreference, useSoundPreference } from "@/lib/sound-preference";
import { getReadingFontSize, setReadingFontSize } from "@/lib/reading-font";
import { SoundscapeControls } from "./SoundscapeControls";
import {
  canResumeCurrentVoice,
  getVoiceState,
  isAudioPlaying,
  pauseCurrentVoice,
  resumeCurrentVoice,
  type VoiceState,
} from "@/lib/consultation-audio";
import styles from "./ConsultationImmersive.module.css";

export type ConsultationImmersiveProps = {
  session: ReadingSessionPayload;
  revealed: number;
  onRevealNext: () => void;
  chapter: number;
  chapters: { id: string; title: string; positions?: number[]; text?: string }[];
  onSelectChapter: (index: number) => void;
  current: number | null;
  highlightedPositions: number[];
  onSelectCard: (position: number) => void;
  chapterText?: string | null;
  cardNote?: string | null;
  onTogglePresentation: () => void;
  onStartNarration: () => void;
  narrationReady: boolean;
  busy?: boolean;
};

export function ConsultationImmersive({
  session,
  revealed,
  onRevealNext,
  chapter,
  chapters,
  onSelectChapter,
  highlightedPositions,
  onSelectCard,
  chapterText,
  onTogglePresentation,
  onStartNarration,
  narrationReady,
  busy = false,
}: ConsultationImmersiveProps) {
  const total = session.cardsDrawn.length;
  const spread = session.spread || "line3";
  const art = sceneAssets(session.persona);
  const sound = useSoundPreference();

  // Dialog refs
  const helpDialog = useRef<HTMLDialogElement>(null);
  const textDialog = useRef<HTMLDialogElement>(null);
  const optionsDialog = useRef<HTMLDialogElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);

  // Audio & narration state
  const [voice, setVoice] = useState<VoiceState | null>(() => getVoiceState());
  const [dismissedFocusChapter, setDismissedFocusChapter] = useState<string | null>(null);
  const [readingFontSize, setReadingFontSizeState] = useState(18);
  const [playingWelcome, setPlayingWelcome] = useState(false);
  const welcomePlayer = useRef<HTMLAudioElement | null>(null);

  // Mobile line selection for 36 cards
  const [mobileLine, setMobileLine] = useState(0); // 0..3 for lines 1..4
  const [isDesktop, setIsDesktop] = useState(false);
  const prevRevealed = useRef(revealed);
  // The previous value is only used to identify the newly revealed card.
  // eslint-disable-next-line react-hooks/refs
  const newlyRevealed = revealed > prevRevealed.current ? revealed : null;

  useEffect(() => {
    prevRevealed.current = revealed;
  }, [revealed]);

  // Viewport breakpoint detection
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    // Synchronize the client viewport after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Voice state subscription
  useEffect(() => {
    const onVoice = (event: Event) => {
      const next = (event as CustomEvent<VoiceState>).detail;
      setVoice(next);
    };
    const onVoiceLevel = (event: Event) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const raw = (event as CustomEvent<{ level: number }>).detail?.level;
      const level = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
      if (haloRef.current) {
        haloRef.current.style.opacity = level > 0.02 ? String(0.25 + level * 0.55) : "0";
        haloRef.current.style.transform = `scale(${1.02 + level * 0.15})`;
      }
    };
    window.addEventListener("oracle-voice-state", onVoice);
    window.addEventListener("oracle-voice-level", onVoiceLevel);
    return () => {
      window.removeEventListener("oracle-voice-state", onVoice);
      window.removeEventListener("oracle-voice-level", onVoiceLevel);
    };
  }, []);

  // Sync font size
  useEffect(() => {
    const saved = getReadingFontSize();
    // Restore the browser preference after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReadingFontSizeState(saved);
  }, []);

  // Auto-advance mobile line when revealing across 9-card boundary (9->10, 18->19, 27->28)
  useEffect(() => {
    if (spread === "grand36" && !isDesktop && newlyRevealed) {
      // Synchronize the visible line when a card is revealed externally.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (newlyRevealed >= 1 && newlyRevealed <= 9 && mobileLine !== 0) setMobileLine(0);
      else if (newlyRevealed >= 10 && newlyRevealed <= 18 && mobileLine !== 1) setMobileLine(1);
      else if (newlyRevealed >= 19 && newlyRevealed <= 27 && mobileLine !== 2) setMobileLine(2);
      else if (newlyRevealed >= 28 && newlyRevealed <= 36 && mobileLine !== 3) setMobileLine(3);
    }
  }, [newlyRevealed, spread, isDesktop, mobileLine]);

  // Keep mobileLine in sync when desktop chapter changes
  useEffect(() => {
    if (spread === "grand36" && chapter >= 0 && chapter < 4) {
      // A chapter can also change in the shared normal presentation.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMobileLine(chapter);
    }
  }, [chapter, spread]);

  // When chapter ends, reset dismissedFocusChapter
  useEffect(() => {
    const onEnded = () => {
      setDismissedFocusChapter(null);
    };
    window.addEventListener("oracle-chapter-ended", onEnded);
    return () => window.removeEventListener("oracle-chapter-ended", onEnded);
  }, []);

  // Determine active chapter ID and playing status
  const isNarrationPlaying = Boolean(voice?.active && voice?.kind === "chapter");
  const activePlayingChapter = voice?.chapter || "";
  const isFocusActive = Boolean(voice?.kind === "chapter" && (voice.active || canResumeCurrentVoice()) && dismissedFocusChapter !== activePlayingChapter);

  const handleReturnToTable = () => {
    setDismissedFocusChapter(activePlayingChapter || "active");
  };

  const handleToggleAudio = () => {
    if (isAudioPlaying()) {
      pauseCurrentVoice();
    } else {
      void resumeCurrentVoice(sound === true);
    }
  };

  const playWelcomeAudio = () => {
    if (!welcomePlayer.current) return;
    if (!welcomePlayer.current.paused) {
      welcomePlayer.current.pause();
      setPlayingWelcome(false);
    } else {
      void welcomePlayer.current.play().then(() => setPlayingWelcome(true)).catch(() => {});
    }
  };

  const changeFontSize = (size: number) => {
    setReadingFontSize(size);
    setReadingFontSizeState(size);
  };

  // Determine cards to display based on spread and viewport
  const displayCards = useMemo(() => {
    if (spread === "grand36" && !isDesktop) {
      // 36 cards on mobile: show only the 9 cards of the active line
      const start = mobileLine * 9;
      return session.cardsDrawn.slice(start, start + 9);
    }
    return session.cardsDrawn;
  }, [spread, isDesktop, mobileLine, session.cardsDrawn]);

  // Title calculation
  const sceneTitle = useMemo(() => {
    if (spread === "line3") return "Sua leitura";
    if (chapters[chapter]?.title) return chapters[chapter].title;
    if (spread === "grand36") return `Linha ${mobileLine + 1} · Mesa Real`;
    if (spread === "box9") return `Linha ${chapter + 1} · Tiragem de 9`;
    return "Sua leitura";
  }, [spread, chapters, chapter, mobileLine]);

  // Portrait file url
  const portraitUrl = art.close || "/avatars/cigana-close-realista.png";

  return (
    <div
      className={`${styles.scene} ${spread === "grand36" ? styles.full36 : styles.smallSpread}`}
      style={{ "--portrait-url": `url("${portraitUrl}")`, "--scene-url": `url("${art.scene}")`, "--scene-concentrating": `url("${art.sceneConcentrating}")`, "--scene-expressing": `url("${art.sceneExpressing}")` } as React.CSSProperties}
    >
      <div className={styles.portrait} aria-hidden="true">
        <div className={styles.sceneBase} />
        <div className={`${styles.sceneExpression} ${styles.sceneConcentrating}`} />
        <div className={`${styles.sceneExpression} ${styles.sceneExpressing}`} />
      </div>
      <div className={styles.sceneShade} aria-hidden="true" />
      <div ref={haloRef} className={styles.halo} aria-hidden="true" />

      {/* Top Header */}
      <header className={styles.top}>
        <div className={styles.topTitle}>
          <small>UMA CONVERSA COM O ORÁCULO</small>
          <h1>{session.persona} · {session.userName}</h1>
        </div>
        <div className={styles.topActions}>
          <button
            type="button"
            onClick={() => helpDialog.current?.showModal()}
            className={styles.btnHelp}
            aria-label="Abrir ajuda e instruções"
          >
            Como funciona
          </button>
          <button
            type="button"
            onClick={onTogglePresentation}
            className={styles.btnToggleView}
            aria-label="Alternar para visão normal de mesa"
          >
            Visão normal
          </button>
        </div>
      </header>

      {/* Main Table Content (when not in character focus) */}
      <main data-immersive-table className={styles.bottom} style={{ display: isFocusActive ? "none" : "flex" }}>
        <div className={styles.readingMeta}>
          <span className={styles.eyebrow}>
            {spread === "grand36"
              ? `MESA REAL · 36 CARTAS`
              : spread === "box9"
              ? "TIRAGEM DE 9 CARTAS"
              : spread === "line5"
              ? "TIRAGEM DE 5 CARTAS"
              : "TIRAGEM DE 3 CARTAS"}
          </span>
          <h2 className={styles.title}>{sceneTitle}</h2>
          <p className={styles.subtitle}>
            {revealed === total
              ? "Mesa completa · Toque em uma carta para ampliar"
              : `${revealed} de ${total} cartas reveladas`}
          </p>
        </div>

        {/* Cards Grid */}
        <div
          className={`${styles.cards} ${
            spread === "line3"
              ? styles.grid3
              : spread === "line5"
              ? styles.grid5
              : spread === "box9" || (spread === "grand36" && !isDesktop)
              ? styles.grid9
              : styles.grid36
          }`}
          role="region"
          aria-label="Mesa de cartas"
        >
          {displayCards.map((card) => {
            const isOpened = card.position <= revealed;
            const isNewlyRevealed = card.position === newlyRevealed;
            const isHighlighted =
              highlightedPositions.length === 0 || highlightedPositions.includes(card.position);
            const isDimmed = isOpened && highlightedPositions.length > 0 && !isHighlighted;

            return (
              <button
                key={card.position}
                type="button"
                disabled={!isOpened && card.position !== revealed + 1}
                onClick={() => {
                  if (isOpened) onSelectCard(card.position);
                  else if (card.position === revealed + 1) onRevealNext();
                }}
                className={`${styles.cardSlot} ${isOpened ? styles.opened : styles.closed} ${
                  isHighlighted ? styles.activeLine : ""
                } ${isDimmed ? styles.dimmed : ""} ${isNewlyRevealed ? styles.revealing : ""}`}
                aria-label={
                  isOpened
                    ? `Carta ${card.position}: ${card.name?.replace(/^\d+\.\s*/, "") || "Carta"}. Toque para ampliar.`
                    : `Posição ${card.position} fechada.`
                }
              >
                {isOpened ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.imageUrl || `/cards/cigano/card-${card.id}.jpg`}
                    alt={card.name || `Carta ${card.position}`}
                    loading="lazy"
                  />
                ) : (
                  <span>{card.position}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Line Navigation and Text Access Controls */}
        <div className={styles.controlsRow}>
          {spread === "grand36" && (
            <div className={styles.lineTabs} role="tablist" aria-label="Linhas da mesa real">
              {[0, 1, 2, 3].map((idx) => (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={isDesktop ? chapter === idx : mobileLine === idx}
                  onClick={() => {
                    if (isDesktop) onSelectChapter(idx);
                    else setMobileLine(idx);
                  }}
                  className={`${styles.lineTab} ${
                    (isDesktop ? chapter === idx : mobileLine === idx) ? styles.active : ""
                  }`}
                >
                  Linha {idx + 1}
                </button>
              ))}
            </div>
          )}

          {spread === "box9" && (
            <div className={styles.lineTabs} role="tablist" aria-label="Linhas da tiragem de 9">
              {[0, 1, 2].map((idx) => (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={chapter === idx}
                  onClick={() => onSelectChapter(idx)}
                  className={`${styles.lineTab} ${chapter === idx ? styles.active : ""}`}
                >
                  Linha {idx + 1}
                </button>
              ))}
            </div>
          )}

          {chapterText && (
            <button
              type="button"
              onClick={() => textDialog.current?.showModal()}
              className={styles.actionBtn}
              aria-label="Ver texto da interpretação"
            >
              Ver texto
            </button>
          )}

          {!isNarrationPlaying && !canResumeCurrentVoice() && (
            <button type="button" onClick={onStartNarration} disabled={!narrationReady} className={styles.actionBtn}>
              {narrationReady ? "Ouvir esta leitura" : "Revele as cartas para ouvir"}
            </button>
          )}

          {isNarrationPlaying && dismissedFocusChapter && (
            <button
              type="button"
              onClick={() => setDismissedFocusChapter(null)}
              className={styles.actionBtn}
              style={{ borderColor: "#67e8f9", color: "#a5f3fc" }}
              aria-label="Retornar ao foco na personagem durante a narração"
            >
              ✦ Foco na personagem
            </button>
          )}
        </div>

        {/* Bottom Dock: Deck at bottom-left, Avatar button at bottom-right */}
        <div className={styles.bottomDock}>
          <div className={styles.deckCluster}>
            <button
              type="button"
              disabled={busy || revealed >= total}
              onClick={onRevealNext}
              className={`${styles.deckStack} ${revealed >= total ? styles.completed : ""}`}
              aria-label={
                revealed >= total
                  ? "Todas as cartas foram tiradas"
                  : `Tirar próxima carta (${revealed + 1} de ${total})`
              }
            />
            <div className={styles.deckMeta}>
              <span className={styles.deckPrompt}>
                {revealed >= total ? "Mesa completa" : busy ? "Revelando…" : "Toque para tirar"}
              </span>
              <span className={styles.deckCount}>
                {revealed} de {total} cartas
              </span>
            </div>
          </div>

          <div className={styles.avatarCluster}>
            <button
              ref={optionsButtonRef}
              type="button"
              onClick={() => optionsDialog.current?.showModal()}
              className={styles.avatarBtn}
              aria-label="Abrir controles da consulta e opções de áudio"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={portraitUrl} alt={session.persona} />
              <span className={styles.avatarLabel}>Opções</span>
            </button>
          </div>
        </div>
      </main>

      {/* Character Focus Overlay during narration (Section 5) */}
      {isFocusActive && (
        <section
          className={styles.characterFocusContainer}
          data-immersive-focus
          aria-label="Foco na personagem durante a narração"
        >
          <div className={styles.focusTop}>
            <span className={styles.focusBadge}>
              <span className={styles.pulseDot} aria-hidden="true" />
              <span>{isNarrationPlaying ? "Ouvindo narração" : "Narração pausada"}</span>
            </span>
            <button
              type="button"
              onClick={handleReturnToTable}
              className={styles.actionBtn}
              aria-label="Voltar à mesa de cartas sem pausar áudio"
            >
              Voltar à mesa
            </button>
          </div>

          <div className={styles.focusCenter}>
            <h2 className={styles.focusTitle}>{sceneTitle}</h2>
            <div className={styles.focusControls}>
              <button
                type="button"
                onClick={handleToggleAudio}
                className={styles.actionBtn}
                style={{ borderColor: "#f5d889", color: "#fff0d8", fontWeight: 600 }}
              >
                {isAudioPlaying() ? "Ⅱ Pausar leitura" : "▶ Continuar leitura"}
              </button>
              {chapterText && (
                <button
                  type="button"
                  onClick={() => textDialog.current?.showModal()}
                  className={styles.actionBtn}
                >
                  Ver texto
                </button>
              )}
            </div>
          </div>

          {/* Related Cards Strip at the bottom */}
          <div className={styles.focusStrip}>
            <span className={styles.focusStripHeader}>Cartas deste trecho</span>
            <div className={styles.focusCardList}>
              {session.cardsDrawn
                .filter(
                  (card) =>
                    highlightedPositions.length === 0 ||
                    highlightedPositions.includes(card.position)
                )
                .map((card) => (
                  <button
                    key={card.position}
                    type="button"
                    onClick={() => onSelectCard(card.position)}
                    className={styles.focusCardItem}
                    aria-label={`Carta ${card.position}: ${card.name}. Toque para ampliar.`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.imageUrl || `/cards/cigano/card-${card.id}.jpg`}
                      alt={card.name || ""}
                    />
                    <span className={styles.focusCardNumber}>{card.position}</span>
                  </button>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* Help Dialog ("Como funciona") */}
      <dialog
        ref={helpDialog}
        aria-labelledby="immersive-help-title"
        className={styles.dialog}
        onKeyDown={(e) => {
          if (e.key === "Escape") helpDialog.current?.close();
        }}
      >
        <div className={styles.dialogHeader}>
          <h2 id="immersive-help-title">Como funciona</h2>
          <button
            type="button"
            onClick={() => helpDialog.current?.close()}
            className={styles.actionBtn}
            aria-label="Fechar ajuda"
          >
            ✕
          </button>
        </div>
        <div className={styles.dialogScroll}>
          <p>
            A consulta oracular é uma experiência de reflexão pessoal e simbólica. Cada carta traz
            arquétipos tradicionais para inspirar escolhas, clareza e diálogo interior.
          </p>
          <p style={{ marginTop: "10px" }}>
            As cartas são reveladas sequencialmente. Ao tocar em qualquer carta aberta, você pode
            ampliá-la para ver sua arte e seu significado detalhado.
          </p>
          <p style={{ marginTop: "10px" }}>
            Esta experiência é um suporte de introspecção e não substitui aconselhamento médico,
            jurídico ou financeiro.
          </p>
        </div>
        <button
          type="button"
          onClick={() => helpDialog.current?.close()}
          className={styles.dialogCloseBtn}
        >
          Entendi, voltar à consulta
        </button>
      </dialog>

      {/* Text Dialog ("Ver texto") */}
      <dialog
        ref={textDialog}
        aria-labelledby="immersive-text-title"
        className={styles.dialog}
        onKeyDown={(e) => {
          if (e.key === "Escape") textDialog.current?.close();
        }}
      >
        <div className={styles.dialogHeader}>
          <h2 id="immersive-text-title">{sceneTitle}</h2>
          <button
            type="button"
            onClick={() => textDialog.current?.close()}
            className={styles.actionBtn}
            aria-label="Fechar texto"
          >
            ✕
          </button>
        </div>
        <div className={styles.dialogScroll}>
          <p style={{ whiteSpace: "pre-line" }}>
            {chapterText || "A interpretação deste trecho estará disponível ao abrir as cartas correspondentes."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => textDialog.current?.close()}
          className={styles.dialogCloseBtn}
        >
          Fechar texto
        </button>
      </dialog>

      {/* Options Dialog (Avatar Button) */}
      <dialog
        ref={optionsDialog}
        aria-labelledby="immersive-options-title"
        className={styles.dialog}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            optionsDialog.current?.close();
            optionsButtonRef.current?.focus();
          }
        }}
      >
        <div className={styles.dialogHeader}>
          <h2 id="immersive-options-title">Controles da consulta</h2>
          <button
            type="button"
            onClick={() => {
              optionsDialog.current?.close();
              optionsButtonRef.current?.focus();
            }}
            className={styles.actionBtn}
            aria-label="Fechar opções"
          >
            ✕
          </button>
        </div>
        <div className={styles.dialogScroll}>
          <div style={{ marginBottom: "14px" }}>
            <span style={{ fontSize: "12px", color: "#efcd8e", textTransform: "uppercase", fontWeight: 600 }}>
              Som e narração
            </span>
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              <button
                type="button"
                onClick={() => setSoundPreference(true)}
                className={styles.actionBtn}
                style={{ borderColor: sound === true ? "#f5d889" : "#b5966d" }}
              >
                Habilitar som
              </button>
              <button
                type="button"
                onClick={() => setSoundPreference(false)}
                className={styles.actionBtn}
                style={{ borderColor: sound === false ? "#f5d889" : "#b5966d" }}
              >
                Desabilitar som
              </button>
            </div>
            {sound === true && (
              <button
                type="button"
                onClick={playWelcomeAudio}
                className={styles.actionBtn}
                style={{ marginTop: "8px", width: "100%" }}
              >
                {playingWelcome ? "Pausar acolhimento" : "Ouvir acolhimento"}
              </button>
            )}
          </div>

          <div style={{ marginBottom: "14px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "10px" }}>
            <span style={{ fontSize: "12px", color: "#efcd8e", textTransform: "uppercase", fontWeight: 600 }}>
              Tamanho do texto
            </span>
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              <button
                type="button"
                disabled={readingFontSize === 16}
                onClick={() => changeFontSize(Math.max(16, readingFontSize - 2))}
                className={styles.actionBtn}
              >
                A−
              </button>
              <button
                type="button"
                disabled={readingFontSize === 22}
                onClick={() => changeFontSize(Math.min(22, readingFontSize + 2))}
                className={styles.actionBtn}
              >
                A+
              </button>
              <button
                type="button"
                onClick={() => changeFontSize(18)}
                className={styles.actionBtn}
              >
                Padrão
              </button>
            </div>
          </div>

          <div style={{ marginBottom: "14px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "10px" }}>
            <SoundscapeControls persona={session.persona} sessionId={session.id} />
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "10px" }}>
            <button
              type="button"
              onClick={() => {
                optionsDialog.current?.close();
                onTogglePresentation();
              }}
              className={styles.actionBtn}
              style={{ width: "100%", justifyContent: "center" }}
            >
              Alternar para visão normal ↗
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            optionsDialog.current?.close();
            optionsButtonRef.current?.focus();
          }}
          className={styles.dialogCloseBtn}
        >
          Fechar controles
        </button>
      </dialog>

      {/* Hidden audio for welcome message */}
      <audio
        ref={welcomePlayer}
        preload="none"
        src={`/audio/welcome-${session.persona === "Linha de Umbanda" ? "umbanda" : session.persona === "Cigana Tradicional" ? "cigano" : "cosmico"}.wav`}
        onEnded={() => setPlayingWelcome(false)}
        onPause={() => setPlayingWelcome(false)}
      />
    </div>
  );
}
