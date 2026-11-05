"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ReadingSessionPayload } from "@/types";
import { sceneAssets, sceneLoops, type OracleState } from "@/lib/scene-assets";
import { setSoundPreference, useSoundPreference } from "@/lib/sound-preference";
import { getReadingFontSize, setReadingFontSize } from "@/lib/reading-font";
import { SoundscapeControls } from "./SoundscapeControls";
import {
  canResumeCurrentVoice,
  getChapterAudioState,
  getVoiceState,
  isAudioPlaying,
  pauseCurrentVoice,
  resumeCurrentVoice,
  type ChapterAudioStatus,
  type VoiceState,
} from "@/lib/consultation-audio";
import styles from "./ConsultationImmersive.module.css";

type Card = ReadingSessionPayload["cardsDrawn"][number];

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
  onStartNarration: () => void;
  narrationReady: boolean;
  busy?: boolean;
  onRequestUnlock?: () => void;
  unlockLabel?: string;
  onReset?: () => void;
  extras?: React.ReactNode;
};

const SPREAD_LABEL: Record<string, string> = {
  line3: "Tiragem de 3 cartas",
  line5: "Tiragem de 5 cartas",
  box9: "Tiragem de 9 cartas",
  grand36: "Mesa Real · 36 cartas",
};

/** Resized, modern-format card art through the Next image optimizer (falls back to the raw file). */
function cardSrc(card: Card, width: 256 | 828) {
  const raw = card.imageUrl || `/cards/cigano/card-${card.id}.jpg`;
  if (!raw.startsWith("/")) return raw;
  return `/_next/image?url=${encodeURIComponent(raw)}&w=${width}&q=75`;
}

function cardName(card: Card) {
  return card.name?.replace(/^\d+\.\s*/, "") || "Carta";
}

const DUST = Array.from({ length: 14 }, (_, index) => index);
// Big spreads place each revealed card by themselves after this long (keep in sync with .placeTimer in the CSS).
const REVEAL_AUTO_MS = 3400;

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
  cardNote,
  onStartNarration,
  narrationReady,
  busy = false,
  onRequestUnlock,
  unlockLabel,
  onReset,
  extras,
}: ConsultationImmersiveProps) {
  const total = session.cardsDrawn.length;
  const spread = session.spread || "line3";
  const bigSpread = spread === "box9" || spread === "grand36";
  const lineSize = spread === "grand36" ? 9 : spread === "box9" ? 3 : 0;
  const art = sceneAssets(session.persona);
  const loops = sceneLoops(session.persona);
  const sound = useSoundPreference();

  const menuDialog = useRef<HTMLDialogElement>(null);
  const textDialog = useRef<HTMLDialogElement>(null);
  const mesaDialog = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const speakingLayer = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const welcomePlayer = useRef<HTMLAudioElement | null>(null);

  const activeChapterId = useMemo(() => {
    if (spread === "line5") return "synthesis";
    if (chapter === chapters.length) return "synthesis";
    return chapters[chapter]?.id || "section1";
  }, [spread, chapter, chapters]);

  const [voice, setVoice] = useState<VoiceState | null>(() => getVoiceState());
  const [chapterAudioStatus, setChapterAudioStatus] = useState<ChapterAudioStatus>(
    () => getChapterAudioState(session.id, activeChapterId).status
  );
  const [readingFontSize, setReadingFontSizeState] = useState(18);
  const [playingWelcome, setPlayingWelcome] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  // Cards already "seen": a reveal overlay shows while revealed > seen. Starts at revealed so a resumed reading does not replay.
  const [seen, setSeen] = useState(revealed);

  const isNarrationPlaying = Boolean(voice?.active && voice?.kind === "chapter");
  const canResumeChapter = Boolean(voice?.kind === "chapter" && !voice.active && canResumeCurrentVoice());
  const isPreparingAudio =
    narrationReady && sound === true && (chapterAudioStatus === "pending" || chapterAudioStatus === "generating");
  const revealCard = revealed > seen ? session.cardsDrawn[revealed - 1] ?? null : null;

  const oracleState: OracleState = revealCard
    ? "revealing"
    : isNarrationPlaying
      ? "speaking"
      : isPreparingAudio || busy
        ? "concentrating"
        : "idle";

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    // Synchronize the client viewport after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDesktop(mq.matches);
    const handler = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    // Restore the browser preference after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReadingFontSizeState(getReadingFontSize());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChapterAudioStatus(getChapterAudioState(session.id, activeChapterId).status);
    const onVoice = (event: Event) => setVoice((event as CustomEvent<VoiceState>).detail);
    const onChapterState = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId: string; chapter: string; state: { status: ChapterAudioStatus } }>).detail;
      if (detail?.sessionId === session.id && detail.chapter === activeChapterId) setChapterAudioStatus(detail.state.status);
    };
    // Voice level drives the "speaking" still (a cheap lip-sync) and the halo, straight on the DOM to avoid re-renders.
    const onVoiceLevel = (event: Event) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const raw = (event as CustomEvent<{ level: number }>).detail?.level;
      const level = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
      if (speakingLayer.current) speakingLayer.current.style.opacity = String(Math.min(1, level * 2.4));
      if (haloRef.current) {
        haloRef.current.style.opacity = level > 0.02 ? String(0.2 + level * 0.5) : "0";
        haloRef.current.style.transform = `scale(${1 + level * 0.12})`;
      }
    };
    window.addEventListener("oracle-voice-state", onVoice);
    window.addEventListener("oracle-chapter-audio-state", onChapterState);
    window.addEventListener("oracle-voice-level", onVoiceLevel);
    return () => {
      window.removeEventListener("oracle-voice-state", onVoice);
      window.removeEventListener("oracle-chapter-audio-state", onChapterState);
      window.removeEventListener("oracle-voice-level", onVoiceLevel);
    };
  }, [session.id, activeChapterId]);

  useEffect(() => {
    if (!isNarrationPlaying && speakingLayer.current) speakingLayer.current.style.opacity = "0";
  }, [isNarrationPlaying]);

  const dismissReveal = () => {
    setSeen(revealed);
    // Completing a line (or the whole table) on a big spread brings up the full table.
    if (lineSize && revealed > 0 && (revealed % lineSize === 0 || revealed === total) && !isDesktop) {
      mesaDialog.current?.showModal();
    }
  };

  const dismissRef = useRef(dismissReveal);
  useEffect(() => {
    dismissRef.current = dismissReveal;
  });

  // Big spreads: the reveal only flashes the card so 36 reveals don't need 36 extra taps.
  const revealPosition = revealCard?.position ?? null;
  useEffect(() => {
    if (revealPosition === null || !bigSpread) return;
    const timer = window.setTimeout(() => dismissRef.current(), REVEAL_AUTO_MS);
    return () => window.clearTimeout(timer);
  }, [revealPosition, bigSpread]);

  const drawCard = () => {
    if (busy || revealed >= total) return;
    try { navigator.vibrate?.(14); } catch { /* not supported */ }
    onRevealNext();
  };

  const handleToggleAudio = () => {
    if (isAudioPlaying()) pauseCurrentVoice();
    else void resumeCurrentVoice(sound === true);
  };

  const handleRequestOrPlayNarration = () => {
    onStartNarration();
    window.dispatchEvent(new CustomEvent("oracle-immersive-play-request", { detail: { sessionId: session.id, chapter: activeChapterId } }));
  };

  const playWelcomeAudio = () => {
    const player = welcomePlayer.current;
    if (!player) return;
    if (!player.paused) {
      player.pause();
      setPlayingWelcome(false);
    } else {
      void player.play().then(() => setPlayingWelcome(true)).catch(() => {});
    }
  };

  const changeFontSize = (size: number) => {
    setReadingFontSize(size);
    setReadingFontSizeState(size);
  };

  const closeMenu = () => {
    menuDialog.current?.close();
    menuButtonRef.current?.focus();
  };

  const chapterTitle = chapter === chapters.length ? "Síntese da mesa" : chapters[chapter]?.title || "Sua leitura";
  const opened = session.cardsDrawn.filter((card) => card.position <= revealed);
  // Mobile table: small spreads keep every position on the table; big ones show the latest cards and the full table lives in a sheet.
  // While drawing, the fan shows the latest cards; once the table is complete it shows the cards of the part being read.
  const chapterCards = opened.filter((card) => highlightedPositions.includes(card.position));
  const followChapter = revealed >= total && chapterCards.length > 0 && chapterCards.length <= 9;
  const tableCards = bigSpread && !isDesktop ? (followChapter ? chapterCards : opened.slice(-5)) : session.cardsDrawn;
  const chapterChips = bigSpread ? [...chapters.map((item) => item.title), "Síntese"] : [];

  // What the oracle "says" in the caption: one short line, always about the next step.
  const caption = revealCard
    ? bigSpread ? `Carta ${revealCard.position}: ${cardName(revealCard)}` : null
    : canResumeChapter
      ? "Narração pausada"
      : isPreparingAudio
        ? "Estou me concentrando nas suas cartas…"
        : isNarrationPlaying
          ? null
          : onRequestUnlock
            ? "Há mais cartas esperando por você na mesa."
            : revealed === 0
              ? "Respire fundo. Quando sentir que é a hora, toque no baralho."
              : revealed < total
                ? "Continue. A próxima carta já está esperando."
                : narrationReady
                  ? "Sua mesa está completa. Quer ouvir o que ela diz?"
                  : "Sua mesa está completa.";

  const isRevealOpen = (position: number) => position <= revealed;
  const lineOf = (position: number) => (lineSize ? Math.ceil(position / lineSize) - 1 : 0);

  const renderMesaGrid = (compact: boolean) => (
    <div
      className={`${styles.mesaGrid} ${spread === "grand36" ? styles.mesa36 : spread === "box9" ? styles.mesa9 : styles.mesaLine} ${compact ? styles.mesaCompact : ""}`}
      role="list"
      aria-label="Mesa completa"
    >
      {session.cardsDrawn.map((card) => {
        const open = isRevealOpen(card.position);
        const lit = highlightedPositions.length === 0 || highlightedPositions.includes(card.position);
        return (
          <button
            key={card.position}
            type="button"
            role="listitem"
            disabled={!open}
            onClick={() => {
              mesaDialog.current?.close();
              onSelectCard(card.position);
            }}
            className={`${styles.mesaCard} ${open ? styles.mesaOpen : ""} ${open && !lit ? styles.mesaDim : ""}`}
            aria-label={open ? `Carta ${card.position}: ${cardName(card)}. Toque para ampliar.` : `Posição ${card.position} fechada.`}
          >
            {open ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cardSrc(card, 256)} alt="" loading="lazy" decoding="async" />
            ) : (
              <span>{card.position}</span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className={`${styles.scene} ${bigSpread ? styles.sceneBig : ""}`}
      data-state={oracleState}
      style={{ "--scene-url": `url("${art.scene}")`, "--reading-size": `${readingFontSize}px` } as React.CSSProperties}
    >
      {/* Desktop ambience: the scene itself, blurred, fills the room behind the stage. */}
      <div className={styles.room} aria-hidden="true" />

      {/* The oracle. One layer per state; video loops replace stills when they exist. */}
      <div className={styles.stage} aria-hidden="true">
        <div className={styles.stageInner}>
          {(["idle", "concentrating", "speaking", "revealing"] as const).map((state) => {
            const still = state === "concentrating" ? art.sceneConcentrating : state === "speaking" ? null : state === "revealing" ? art.sceneConcentrating : art.scene;
            const loop = loops[state];
            const active = oracleState === state || (state === "idle" && oracleState === "speaking" && !loops.speaking);
            if (loop) {
              return (
                <video
                  key={state}
                  className={`${styles.layer} ${active ? styles.layerOn : ""}`}
                  src={loop}
                  poster={still ?? art.scene}
                  muted
                  loop
                  playsInline
                  autoPlay
                  preload={state === "idle" ? "auto" : "metadata"}
                />
              );
            }
            if (!still) return null;
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={state}
                className={`${styles.layer} ${active ? styles.layerOn : ""}`}
                src={still}
                alt=""
                decoding="async"
                fetchPriority={state === "idle" ? "high" : "low"}
              />
            );
          })}
          {/* Speaking still, modulated by the voice level while narration plays (no loop video yet). */}
          {!loops.speaking && (
            <div ref={speakingLayer} className={styles.speakingLayer} style={{ backgroundImage: `url("${art.sceneExpressing}")` }} />
          )}
        </div>
        <div className={styles.candlelight} />
        <div className={styles.dust}>
          {DUST.map((index) => <span key={index} style={{ "--i": index } as React.CSSProperties} />)}
        </div>
        <div ref={haloRef} className={styles.halo} />
        <div className={styles.shade} />
      </div>

      <header className={styles.top}>
        <div className={styles.topTitle}>
          <small>{SPREAD_LABEL[spread] ?? "Consulta"}</small>
          <span>{session.persona}</span>
        </div>
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => menuDialog.current?.showModal()}
          className={styles.menuBtn}
          aria-label="Abrir menu da consulta"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </header>

      <main className={styles.table} data-immersive-table>
        {caption && (
          <p key={caption} className={styles.caption} role="status" aria-live="polite">
            {caption}
          </p>
        )}

        <div className={styles.tableTop}>
          {(!bigSpread || isDesktop) ? (
            isDesktop && bigSpread ? (
              renderMesaGrid(false)
            ) : (
              <div className={`${styles.spreadRow} ${spread === "line5" ? styles.row5 : styles.row3}`} role="list" aria-label="Mesa de cartas">
                {tableCards.map((card) => {
                  const open = isRevealOpen(card.position);
                  const next = card.position === revealed + 1;
                  const lit = highlightedPositions.length === 0 || highlightedPositions.includes(card.position);
                  return (
                    <button
                      key={card.position}
                      type="button"
                      role="listitem"
                      disabled={!open && !next}
                      onClick={() => (open ? onSelectCard(card.position) : drawCard())}
                      className={`${styles.tableCard} ${open ? styles.tableOpen : next ? styles.tableNext : ""} ${open && !lit ? styles.tableDim : ""}`}
                      aria-label={open ? `Carta ${card.position}: ${cardName(card)}. Toque para ampliar.` : `Posição ${card.position} fechada.`}
                    >
                      {open ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cardSrc(card, 256)} alt="" decoding="async" />
                      ) : (
                        <span>{card.position}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div className={styles.recent}>
              <div className={`${styles.recentFan} ${tableCards.length > 5 ? styles.fanMany : ""}`} role="list" aria-label={followChapter ? `Cartas de ${chapterTitle}` : "Últimas cartas tiradas"}>
                {tableCards.map((card, index) => (
                  <button
                    key={card.position}
                    type="button"
                    role="listitem"
                    onClick={() => onSelectCard(card.position)}
                    className={styles.fanCard}
                    style={{ "--k": index - (tableCards.length - 1) / 2 } as React.CSSProperties}
                    aria-label={`Carta ${card.position}: ${cardName(card)}. Toque para ampliar.`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cardSrc(card, 256)} alt="" decoding="async" />
                  </button>
                ))}
              </div>
              <div className={styles.chipRow}>
                <button type="button" className={styles.mesaChip} onClick={() => mesaDialog.current?.showModal()}>
                  Ver mesa · {revealed}/{total}
                </button>
                {/* Which part the narration/text refers to; tapping opens the table to switch parts. */}
                <button
                  type="button"
                  className={`${styles.mesaChip} ${styles.chapterChip}`}
                  onClick={() => mesaDialog.current?.showModal()}
                  aria-label={`Lendo: ${chapterTitle}. Toque para trocar o trecho.`}
                >
                  <span aria-hidden="true">✦</span> {chapterTitle}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.controls}>
          {onRequestUnlock ? (
            <>
              <button type="button" onClick={onRequestUnlock} className={styles.unlockBtn}>
                <span aria-hidden="true">✦</span> {unlockLabel ?? "Abrir leitura completa"}
              </button>
              {/* Grátis: voz e conversa ao vivo aparecem, mas pedem o pagamento. */}
              <button type="button" onClick={onRequestUnlock} className={styles.ghostBtn} aria-label="Ouvir a leitura (disponível na leitura completa)">
                🔒 Ouvir a leitura
              </button>
              <button type="button" onClick={onRequestUnlock} className={styles.ghostBtn} aria-label="Conversar ao vivo (disponível na leitura completa)">
                🔒 Conversar ao vivo
              </button>
            </>
          ) : isNarrationPlaying ? (
            <button type="button" onClick={handleToggleAudio} className={styles.voiceBtn}>
              <span className={styles.voiceWave} aria-hidden="true"><i /><i /><i /></span> Ⅱ Pausar leitura
            </button>
          ) : canResumeChapter ? (
            <button type="button" onClick={handleToggleAudio} className={styles.voiceBtn}>
              ▶ Continuar leitura
            </button>
          ) : narrationReady ? (
            <button
              type="button"
              onClick={handleRequestOrPlayNarration}
              disabled={isPreparingAudio}
              className={`${styles.voiceBtn} ${isPreparingAudio ? styles.voicePreparing : ""}`}
            >
              {isPreparingAudio ? "✦ Preparando a voz…" : "▶ Ouvir esta leitura"}
            </button>
          ) : null}
          {chapterText && (
            <button type="button" onClick={() => textDialog.current?.showModal()} className={styles.ghostBtn}>
              Ler texto
            </button>
          )}
        </div>

        <div className={styles.deckZone}>
          <button
            type="button"
            disabled={busy || revealed >= total}
            onClick={drawCard}
            className={`${styles.deck} ${revealed >= total ? styles.deckDone : ""} ${busy ? styles.deckBusy : ""}`}
            aria-label={revealed >= total ? "Todas as cartas foram tiradas" : `Tirar próxima carta (${revealed + 1} de ${total})`}
          >
            <span className={styles.deckCard} aria-hidden="true" />
            <span className={styles.deckCard} aria-hidden="true" />
            <span className={styles.deckCard} aria-hidden="true" />
          </button>
          <span className={styles.deckHint}>
            {revealed >= total ? "Mesa completa" : busy ? "Revelando…" : `Toque no baralho · ${revealed}/${total}`}
          </span>
        </div>
      </main>

      {/* Reveal: the card rises from the deck, turns over and waits to be placed on the table. */}
      {revealCard && (
        <div
          key={revealCard.position}
          className={styles.reveal}
          onClick={dismissReveal}
          role="dialog"
          aria-modal="false"
          aria-label={`Carta ${revealCard.position}: ${cardName(revealCard)}`}
        >
          <div className={styles.revealBurst} aria-hidden="true" />
          <div className={styles.revealCard}>
            <div className={styles.revealFlip}>
              <span className={styles.revealBack} aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.revealFace} src={cardSrc(revealCard, 828)} alt={cardName(revealCard)} decoding="async" />
            </div>
          </div>
          <div className={styles.revealInfo}>
            <small>Carta {revealCard.position}</small>
            <h2>{cardName(revealCard)}</h2>
            {cardNote && <p>{cardNote}</p>}
            <button type="button" className={`${styles.ghostBtn} ${styles.placeBtn}`} onClick={(event) => { event.stopPropagation(); dismissReveal(); }}>
              Colocar na mesa
              {/* Big spreads place the card by themselves; the bar shows how long is left. */}
              {bigSpread && <span className={styles.placeTimer} aria-hidden="true" />}
            </button>
          </div>
        </div>
      )}

      {/* Full table (big spreads on mobile). */}
      <dialog ref={mesaDialog} className={styles.sheet} aria-labelledby="mesa-title" onClick={(event) => { if (event.target === event.currentTarget) mesaDialog.current?.close(); }}>
        <div className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.sheetHeader}>
          <h2 id="mesa-title">Sua mesa · {revealed}/{total}</h2>
          <button type="button" className={styles.iconBtn} onClick={() => mesaDialog.current?.close()} aria-label="Fechar mesa">✕</button>
        </div>
        {chapterChips.length > 0 && (
          <div className={styles.chips} role="tablist" aria-label="Trechos da leitura">
            {chapterChips.map((title, index) => (
              <button
                key={title + index}
                type="button"
                role="tab"
                aria-selected={chapter === index}
                className={`${styles.chip} ${chapter === index ? styles.chipOn : ""}`}
                onClick={() => onSelectChapter(index)}
              >
                {title}
              </button>
            ))}
          </div>
        )}
        {renderMesaGrid(true)}
        {lineSize > 0 && revealed < total && (
          <button type="button" className={styles.primaryBtn} onClick={() => { mesaDialog.current?.close(); drawCard(); }}>
            Tirar a carta {revealed + 1}
          </button>
        )}
      </dialog>

      {/* Chapter text. */}
      <dialog ref={textDialog} className={styles.sheet} aria-labelledby="immersive-text-title" onClick={(event) => { if (event.target === event.currentTarget) textDialog.current?.close(); }}>
        <div className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.sheetHeader}>
          <h2 id="immersive-text-title">{chapterTitle}</h2>
          <button type="button" className={styles.iconBtn} onClick={() => textDialog.current?.close()} aria-label="Fechar texto">✕</button>
        </div>
        <div className={styles.sheetScroll}>
          <p className={styles.readingText}>
            {chapterText || "A interpretação deste trecho aparece quando as cartas dele estiverem abertas."}
          </p>
        </div>
      </dialog>

      {/* The one menu: sound, text size, ambience, help, extras and a new reading. */}
      <dialog ref={menuDialog} className={styles.sheet} aria-labelledby="immersive-options-title" onClose={() => menuButtonRef.current?.focus()} onClick={(event) => { if (event.target === event.currentTarget) closeMenu(); }}>
        <div className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.sheetHeader}>
          <h2 id="immersive-options-title">Menu da consulta</h2>
          <button type="button" className={styles.iconBtn} onClick={closeMenu} aria-label="Fechar menu">✕</button>
        </div>
        <div className={styles.sheetScroll}>
          {bigSpread && !isDesktop && (
            <button type="button" className={styles.menuRow} onClick={() => { closeMenu(); mesaDialog.current?.showModal(); }}>
              Ver a mesa completa
            </button>
          )}
          {chapterText && (
            <button type="button" className={styles.menuRow} onClick={() => { closeMenu(); textDialog.current?.showModal(); }}>
              Ler o texto deste trecho
            </button>
          )}

          <section className={styles.menuSection}>
            <h3>Som</h3>
            <div className={styles.segmented}>
              <button type="button" aria-pressed={sound === true} onClick={() => setSoundPreference(true)}>Com som</button>
              <button type="button" aria-pressed={sound === false} onClick={() => setSoundPreference(false)}>Sem som</button>
            </div>
            {sound === true && (
              <button type="button" className={styles.menuRow} onClick={playWelcomeAudio}>
                {playingWelcome ? "Pausar acolhimento" : "Ouvir acolhimento"}
              </button>
            )}
            <SoundscapeControls persona={session.persona} sessionId={session.id} />
          </section>

          <section className={styles.menuSection}>
            <h3>Tamanho do texto</h3>
            <div className={styles.segmented}>
              <button type="button" disabled={readingFontSize <= 16} onClick={() => changeFontSize(Math.max(16, readingFontSize - 2))}>A−</button>
              <button type="button" aria-pressed={readingFontSize === 18} onClick={() => changeFontSize(18)}>Padrão</button>
              <button type="button" disabled={readingFontSize >= 22} onClick={() => changeFontSize(Math.min(22, readingFontSize + 2))}>A+</button>
            </div>
          </section>

          <section className={styles.menuSection}>
            <h3>Como funciona</h3>
            <p>
              Toque no baralho para tirar cada carta. Toque numa carta aberta para ampliá-la. Ao completar a mesa,
              ouça a leitura ou leia o texto. É uma experiência de reflexão simbólica e não substitui aconselhamento
              médico, jurídico ou financeiro.
            </p>
          </section>

          {(extras || onReset) && (
            <section className={styles.menuSection}>
              {extras}
              {onReset && (
                <button type="button" className={styles.menuRow} onClick={() => { closeMenu(); onReset(); }}>
                  Realizar nova leitura
                </button>
              )}
            </section>
          )}
        </div>
      </dialog>

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
