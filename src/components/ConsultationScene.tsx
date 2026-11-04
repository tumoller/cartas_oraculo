"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import type { ReadingSessionPayload } from "@/types";
import { setSoundPreference, useSoundPreference } from "@/lib/sound-preference";
import { sceneAssets } from "@/lib/scene-assets";
import { getReadingFontSize, setReadingFontSize } from "@/lib/reading-font";
import { isLiveVoiceActive, monitorMediaVoice } from "@/lib/consultation-audio";
import { ListeningDock } from "./ListeningDock";
import { SoundscapeControls } from "./SoundscapeControls";

const scenes = {
  "Linha de Umbanda": {
    theme: "umbanda",
    label: "Linha de Umbanda",
  },
  "Cigana Tradicional": {
    theme: "cigano",
    label: "Cigana Tradicional",
  },
  "Oráculo da Galáxia": {
    theme: "cosmico",
    label: "Oráculo da Galáxia",
  },
} as const;

export function ConsultationScene({
  session,
  variant = "standalone",
  onToggleImmersive,
  children,
}: {
  session: ReadingSessionPayload;
  variant?: "standalone" | "tabletop";
  onToggleImmersive?: () => void;
  children?: ReactNode;
}) {
  const tabletop = variant === "tabletop";
  const scene = scenes[session.persona as keyof typeof scenes] ?? scenes["Oráculo da Galáxia"];
  const art = sceneAssets(session.persona);
  const player = useRef<HTMLAudioElement>(null);
  const welcomeAttempted = useRef(false);
  const ring = useRef<HTMLSpanElement>(null);
  const halo = useRef<HTMLDivElement>(null);
  const optionsDialog = useRef<HTMLDialogElement>(null);
  const avatarButton = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  const [soundError, setSoundError] = useState(false);
  const [tableOpen, setTableOpen] = useState(true);
  const [preparation, setPreparation] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [readingFontSize, setReadingFontSizeState] = useState(18);
  const sound = useSoundPreference();
  const playerId = useId();
  const panelId = useId();
  const deck = session.persona === "Linha de Umbanda" ? "umbanda" : session.persona === "Cigana Tradicional" ? "cigano" : "cosmico";
  const total = session.cardsDrawn.length;
  const piles = session.spread === "grand36" ? [9, 9, 9, 9] : session.spread === "box9" ? [3, 3, 3] : Array.from({ length: total }, () => 1);

  const stopRing = () => {
    if (ring.current) {
      ring.current.style.opacity = "0";
      ring.current.style.transform = "scale(1)";
    }
    if (halo.current) halo.current.style.opacity = "0";
  };

  const playWelcome = (consented = false) => {
    welcomeAttempted.current = true;
    if (!player.current || (!consented && sound !== true)) return;
    if (!player.current.paused) { player.current.pause(); return; }
    if (isLiveVoiceActive()) { setSoundError(true); return; }
    setSoundError(false);
    void player.current.play().catch(() => {
      if (consented) setSoundError(true);
    });
  };

  useEffect(() => {
    if (sound === true && !welcomeAttempted.current) playWelcome(false);
  }, [sound]);

  useEffect(() => {
    const welcome = player.current;
    return welcome ? monitorMediaVoice(welcome, "welcome") : undefined;
  }, []);

  useEffect(() => {
    setRevealed(0);
    const reveal = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId: string; position: number; total: number }>).detail;
      if (detail?.sessionId === session.id && detail.total === total && Number.isInteger(detail.position) && detail.position >= 1 && detail.position <= total) {
        setRevealed((current) => Math.max(current, detail.position));
      }
    };
    window.addEventListener("oracle-reveal", reveal);
    return () => window.removeEventListener("oracle-reveal", reveal);
  }, [session.id, total]);

  useEffect(() => {
    let active = false;
    const voiceState = (event: Event) => {
      active = Boolean((event as CustomEvent<{ active: boolean }>).detail?.active);
      if (!active) stopRing();
    };
    const voiceLevel = (event: Event) => {
      if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const raw = (event as CustomEvent<{ level: number }>).detail?.level;
      const level = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
      if (ring.current) {
        ring.current.style.opacity = level > 0.02 ? String(0.25 + level * 0.6) : "0";
        ring.current.style.transform = `scale(${1.06 + level * 0.35})`;
      }
      if (halo.current) halo.current.style.opacity = level > 0.02 ? String(level * 0.55) : "0";
    };
    window.addEventListener("oracle-voice-state", voiceState);
    window.addEventListener("oracle-voice-level", voiceLevel);
    return () => {
      window.removeEventListener("oracle-voice-state", voiceState);
      window.removeEventListener("oracle-voice-level", voiceLevel);
      stopRing();
    };
  }, []);

  useEffect(() => {
    const pause = (event: Event) => { if ((event as CustomEvent<string>).detail !== playerId) player.current?.pause(); };
    const soundOff = () => player.current?.pause();
    window.addEventListener("oracle-audio-start", pause);
    window.addEventListener("oracle-sound-off", soundOff);
    return () => {
      window.removeEventListener("oracle-audio-start", pause);
      window.removeEventListener("oracle-sound-off", soundOff);
    };
  }, [playerId]);

  useEffect(() => {
    const saved = getReadingFontSize();
    setReadingFontSizeState(saved);
    setReadingFontSize(saved);
  }, []);

  const changeReadingFontSize = (size: number) => {
    setReadingFontSize(size);
    setReadingFontSizeState(size);
  };

  return (
    <>
      <section
        aria-label={tabletop ? `Mesa de leitura: ${scene.label}` : `Cena ilustrada da leitura: ${scene.label}`}
        data-scene-persona={scene.theme}
        className={`consultation-scene relative isolate w-full overflow-clip rounded-3xl border shadow-2xl ${
          tabletop ? "scene-tabletop-layout" : "mb-8 max-w-5xl"
        }`}
      >
        <div
          className={`scene-stage relative overflow-hidden ${
            tabletop ? "h-[230px] sm:h-[260px] lg:h-[220px]" : "h-[288px] sm:h-[360px]"
          }`}
        >
          <div aria-hidden="true" className="scene-atmosphere absolute inset-0" />
          <div ref={halo} aria-hidden="true" className="scene-halo absolute inset-0" />
          <div className="scene-portrait absolute inset-0">
            <Image
              src={tabletop ? art.close : art.portrait}
              alt=""
              aria-hidden="true"
              fill
              sizes="(max-width: 640px) 100vw, 900px"
              quality={85}
              className={tabletop ? "object-contain object-bottom scale-110" : "object-contain object-bottom"}
              priority
            />
          </div>
          <div aria-hidden="true" className="scene-vignette absolute inset-x-0 bottom-0 h-24 sm:h-32" />
          {!tabletop && (
            <div className="absolute left-3 top-3 z-10 sm:left-8 sm:top-6">
              <span className="scene-badge inline-block rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[.15em]">
                Sua mesa está pronta
              </span>
            </div>
          )}
          {!tabletop && (
            <>
              <div className="scene-table absolute inset-x-0 bottom-0 h-[86px] sm:h-[105px]" aria-hidden="true" />
              <div
                key={preparation}
                className="scene-piles absolute inset-x-3 bottom-5 z-10 flex items-end justify-center gap-2 sm:inset-x-8 sm:bottom-7 sm:gap-4"
                aria-hidden="true"
              >
                {piles.map((count, index) => (
                  <span
                    key={index}
                    className={`scene-pile ${count > 1 ? "scene-pile-stacked" : ""}`}
                    style={{ animationDelay: `${index * 90}ms` }}
                  >
                    <span className="scene-card-back">✦</span>
                  </span>
                ))}
              </div>
              <span className="absolute bottom-1 right-3 z-10 text-[9px] text-slate-300/80 sm:bottom-2 sm:right-5">
                Versos ilustrativos
              </span>
            </>
          )}
        </div>
        {tabletop ? (
          <div className="scene-toolbar flex shrink-0 flex-wrap items-center justify-center gap-2.5 px-4 py-3 lg:px-5">
            {onToggleImmersive && (
              <button
                type="button"
                onClick={onToggleImmersive}
                className="min-h-10 rounded-full border border-amber-300 bg-amber-900/50 px-4 py-1.5 text-xs font-semibold text-amber-100 shadow-sm hover:bg-amber-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 lg:hidden"
              >
                ✦ Visão imersiva
              </button>
            )}
            <button
              type="button"
              onClick={() => optionsDialog.current?.showModal()}
              className="min-h-10 rounded-full border border-amber-300/50 bg-slate-900/80 px-4 py-1.5 text-xs font-medium text-amber-100 hover:border-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              Som e tamanho do texto
            </button>
            {sound === true && (
              <button
                type="button"
                onClick={() => playWelcome(true)}
                className="min-h-10 rounded-full border border-white/30 bg-slate-900/80 px-4 py-1.5 text-xs text-slate-100 hover:border-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                {playing ? "Pausar acolhimento" : "Ouvir acolhimento"}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="scene-footer flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
              <div>
                <h3 className="font-serif text-lg leading-tight text-white sm:text-2xl">
                  Cada carta abre uma parte da sua história.
                </h3>
                <p className="mt-1 text-xs text-slate-300 sm:text-sm">
                  {revealed
                    ? `${revealed} de ${total} cartas reveladas. Continue no seu ritmo.`
                    : `${total} cartas preparadas. Revele uma de cada vez no seu ritmo.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreparation((value) => value + 1);
                  window.dispatchEvent(new CustomEvent("oracle-preparation", { detail: { sessionId: session.id } }));
                }}
                className="min-h-12 rounded-full border border-amber-300/50 px-4 py-2 text-xs font-medium text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                Rever preparação
              </button>
            </div>
            <div
              role="progressbar"
              aria-label="Cartas reveladas"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={revealed}
              className="scene-progress"
            >
              <span style={{ width: `${total ? (revealed / total) * 100 : 0}%` }} />
            </div>
          </>
        )}
        {sound === null && !tabletop && (
          <div
            className="flex flex-wrap gap-2 border-t border-white/10 bg-slate-950 px-4 pb-4 pt-3 sm:px-8"
            role="group"
            aria-label="Escolha de som da consulta"
          >
            <button
              type="button"
              onClick={() => {
                setSoundPreference(true);
                playWelcome(true);
              }}
              className="min-h-12 rounded-full border border-amber-300/60 bg-amber-300/20 px-4 py-2 text-xs font-medium text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              Começar com som
            </button>
            <button
              type="button"
              onClick={() => setSoundPreference(false)}
              className="min-h-12 rounded-full border border-white/30 bg-slate-950/70 px-4 py-2 text-xs text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              Continuar sem som
            </button>
          </div>
        )}
        {tabletop && (
          <div className="scene-table scene-tabletop" data-table-open={tableOpen}>
            <button
              type="button"
              aria-expanded={tableOpen}
              aria-controls={`${panelId}-table`}
              onClick={() => setTableOpen((open) => !open)}
              className="scene-table-toggle flex min-h-12 w-full items-center justify-between px-4 text-left text-sm font-medium text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-300 lg:hidden"
            >
              <span>{tableOpen ? "Ocultar visão geral" : `Ver mesa · ${total} cartas`}</span>
              <span aria-hidden="true">{tableOpen ? "−" : "+"}</span>
            </button>
            <div id={`${panelId}-table`} className="scene-table-content">
              {children}
            </div>
          </div>
        )}
        <audio
          ref={player}
          preload="none"
          src={`/audio/welcome-${deck}.wav`}
          onPlay={() => {
            setPlaying(true);
            window.dispatchEvent(new CustomEvent("oracle-audio-start", { detail: playerId }));
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      </section>

      <ListeningDock session={session} />

      {/* Botão flutuante do Avatar padronizado (maior e com selo Opções) */}
      <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))] z-50 flex flex-col items-center gap-1 sm:bottom-6 sm:right-6">
        <button
          ref={avatarButton}
          type="button"
          aria-label="Abrir controles da consulta"
          onClick={() => optionsDialog.current?.showModal()}
          className="group relative flex flex-col items-center gap-1 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
        >
          <span className="relative grid size-16 sm:size-[70px] place-items-center rounded-full border-2 border-amber-300/80 bg-slate-950 shadow-[0_0_16px_rgba(245,216,137,0.35)] transition-transform group-hover:scale-105 group-hover:border-amber-200">
            <span
              ref={ring}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-amber-200 opacity-0 transition-[transform,opacity] duration-75 motion-reduce:transition-none"
            />
            <Image
              src={art.close}
              alt=""
              width={64}
              height={64}
              className="size-14 sm:size-16 rounded-full object-cover object-top"
            />
            <span
              aria-hidden="true"
              className="absolute -bottom-0.5 -right-0.5 rounded-full border border-amber-300/50 bg-slate-900 px-1.5 py-0.5 text-[10px] text-amber-200"
            >
              {sound === true ? "♪" : "×"}
            </span>
          </span>
          <span className="rounded-full border border-amber-300/40 bg-slate-950/90 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200 shadow">
            Opções
          </span>
        </button>
      </div>

      {/* Modal Controles da Consulta PADRONIZADO (idêntico ao da Visão Imersiva) */}
      <dialog
        ref={optionsDialog}
        aria-labelledby={`${panelId}-title`}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            optionsDialog.current?.close();
            avatarButton.current?.focus();
          }
        }}
        className="fixed inset-0 m-auto max-h-[92dvh] w-[min(92vw,440px)] rounded-[20px] border border-slate-600/80 bg-slate-950 p-5 text-slate-100 shadow-[0_16px_42px_rgba(0,0,0,0.88)] outline-none backdrop:bg-slate-950/80 backdrop:backdrop-blur-xs"
      >
        <div className="mb-3 flex items-center justify-between border-b border-white/15 pb-2.5">
          <h2 id={`${panelId}-title`} className="font-serif text-xl text-amber-100">
            Controles da consulta
          </h2>
          <button
            type="button"
            onClick={() => {
              optionsDialog.current?.close();
              avatarButton.current?.focus();
            }}
            aria-label="Fechar controles"
            className="inline-flex size-9 items-center justify-center rounded-full border border-slate-500 bg-slate-900 text-sm text-slate-100 hover:border-amber-300 hover:bg-slate-800 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70dvh] space-y-3.5 overflow-y-auto px-0.5 text-left text-sm">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-200">
              Som e narração
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={sound === true}
                onClick={() => setSoundPreference(true)}
                className={`min-h-9 rounded-full border px-4 py-1.5 text-xs cursor-pointer transition-colors ${
                  sound === true
                    ? "border-amber-300 bg-amber-950/60 font-bold text-amber-100"
                    : "border-slate-600 bg-slate-900 text-slate-200 hover:border-slate-400"
                }`}
              >
                Habilitar som
              </button>
              <button
                type="button"
                aria-pressed={sound === false}
                onClick={() => setSoundPreference(false)}
                className={`min-h-9 rounded-full border px-4 py-1.5 text-xs cursor-pointer transition-colors ${
                  sound === false
                    ? "border-amber-300 bg-amber-950/60 font-bold text-amber-100"
                    : "border-slate-600 bg-slate-900 text-slate-200 hover:border-slate-400"
                }`}
              >
                Desabilitar som
              </button>
            </div>
            {sound === true && (
              <button
                type="button"
                onClick={() => playWelcome(true)}
                className="mt-2.5 flex min-h-9 w-full items-center justify-center rounded-full border border-slate-600 bg-slate-900 px-4 py-1.5 text-xs font-medium text-slate-100 hover:border-amber-300 cursor-pointer"
              >
                {playing ? "Pausar acolhimento" : "Ouvir acolhimento"}
              </button>
            )}
            {soundError && (
              <p role="alert" className="mt-2 text-xs text-amber-200">
                {isLiveVoiceActive()
                  ? "Encerre a conversa antes de ouvir o acolhimento."
                  : "Toque em Ouvir acolhimento acima para iniciar a voz."}
              </p>
            )}
          </div>

          <div className="border-t border-white/10 pt-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-200">
              Tamanho do texto ({readingFontSize === 16 ? "menor" : readingFontSize === 18 ? "padrão" : readingFontSize === 20 ? "maior" : "extra grande"})
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Tamanho do texto da leitura">
              <button
                type="button"
                aria-label="Diminuir textos da consulta"
                disabled={readingFontSize === 16}
                onClick={() => changeReadingFontSize(Math.max(16, readingFontSize - 2))}
                className="min-h-9 rounded-full border border-slate-600 bg-slate-900 px-4 py-1.5 text-xs text-slate-100 hover:border-amber-300 disabled:opacity-40 cursor-pointer"
              >
                A−
              </button>
              <button
                type="button"
                aria-label="Aumentar textos da consulta"
                disabled={readingFontSize === 22}
                onClick={() => changeReadingFontSize(Math.min(22, readingFontSize + 2))}
                className="min-h-9 rounded-full border border-slate-600 bg-slate-900 px-4 py-1.5 text-xs text-slate-100 hover:border-amber-300 disabled:opacity-40 cursor-pointer"
              >
                A+
              </button>
              <button
                type="button"
                onClick={() => changeReadingFontSize(18)}
                className="min-h-9 rounded-full border border-slate-600 bg-slate-900 px-4 py-1.5 text-xs text-slate-100 hover:border-amber-300 cursor-pointer"
              >
                Padrão
              </button>
            </div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <SoundscapeControls persona={session.persona} sessionId={session.id} />
          </div>

          {onToggleImmersive && (
            <div className="border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => {
                  optionsDialog.current?.close();
                  onToggleImmersive();
                }}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border-2 border-amber-300/80 bg-linear-to-r from-amber-900/70 via-rose-950/80 to-purple-950/80 px-4 py-2 text-xs font-bold text-amber-100 shadow-[0_0_16px_rgba(245,216,137,0.3)] hover:border-amber-200 cursor-pointer"
              >
                <span aria-hidden="true">✦</span>
                <span>Alternar para visão imersiva ↗</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            optionsDialog.current?.close();
            avatarButton.current?.focus();
          }}
          className="mt-3.5 block w-full rounded-xl border border-slate-600 bg-slate-800/90 py-2.5 text-center text-xs font-semibold text-slate-100 hover:border-amber-300 hover:bg-slate-800 cursor-pointer"
        >
          Fechar controles
        </button>
      </dialog>
    </>
  );
}
