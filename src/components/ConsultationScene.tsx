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
  const panelFirstButton = useRef<HTMLButtonElement>(null);
  const avatarButton = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  const [soundError, setSoundError] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
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
    void player.current.play().catch(() => setSoundError(true));
  };

  useEffect(() => {
    if (sound === true && !welcomeAttempted.current) playWelcome(true);
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

  useEffect(() => { if (panelOpen) panelFirstButton.current?.focus(); }, [panelOpen]);

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
    <><section aria-label={tabletop ? `Mesa de leitura: ${scene.label}` : `Cena ilustrada da leitura: ${scene.label}`} data-scene-persona={scene.theme} className={`consultation-scene relative isolate w-full overflow-clip rounded-3xl border shadow-2xl ${tabletop ? "scene-tabletop-layout" : "mb-8 max-w-5xl"}`}>
      <div className={`scene-stage relative overflow-hidden ${tabletop ? "h-[150px] lg:h-[190px]" : "h-[288px] sm:h-[360px]"}`}>
        <div aria-hidden="true" className="scene-atmosphere absolute inset-0" />
        <div ref={halo} aria-hidden="true" className="scene-halo absolute inset-0" />
        <div className="scene-portrait absolute inset-0">
          <Image src={art.portrait} alt="" aria-hidden="true" fill sizes="(max-width: 640px) 100vw, 900px" quality={80} className="object-contain object-bottom" priority />
        </div>
        <div aria-hidden="true" className="scene-vignette absolute inset-x-0 bottom-0 h-32 sm:h-40" />
        {!tabletop && <div className="absolute left-3 top-3 z-10 sm:left-8 sm:top-6">
          <span className="scene-badge inline-block rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[.15em]">Sua mesa está pronta</span>
        </div>}
        {!tabletop && <><div className="scene-table absolute inset-x-0 bottom-0 h-[86px] sm:h-[105px]" aria-hidden="true" />
        <div key={preparation} className="scene-piles absolute inset-x-3 bottom-5 z-10 flex items-end justify-center gap-2 sm:inset-x-8 sm:bottom-7 sm:gap-4" aria-hidden="true">
          {piles.map((count, index) => <span key={index} className={`scene-pile ${count > 1 ? "scene-pile-stacked" : ""}`} style={{ animationDelay: `${index * 90}ms` }}><span className="scene-card-back">✦</span></span>)}
        </div>
        <span className="absolute bottom-1 right-3 z-10 text-[9px] text-slate-300/80 sm:bottom-2 sm:right-5">Versos ilustrativos</span></>}
      </div>
      {tabletop ? <div className="scene-toolbar flex shrink-0 flex-wrap items-center gap-2 px-4 py-3 lg:px-5">
        {onToggleImmersive && (
          <button type="button" onClick={onToggleImmersive} className="min-h-11 rounded-full border border-amber-300/60 bg-amber-950/40 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">
            ✦ Visão imersiva
          </button>
        )}
        <button type="button" onClick={() => setPanelOpen(true)} className="min-h-11 rounded-full border border-amber-300/50 px-4 py-2 text-xs font-medium text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">Som e tamanho do texto</button>
        {sound === true && <button type="button" onClick={() => playWelcome()} className="min-h-11 rounded-full border border-white/30 px-4 py-2 text-xs text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">{playing ? "Pausar acolhimento" : "Ouvir acolhimento"}</button>}
      </div> : <><div className="scene-footer flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
        <div><h3 className="font-serif text-lg leading-tight text-white sm:text-2xl">Cada carta abre uma parte da sua história.</h3><p className="mt-1 text-xs text-slate-300 sm:text-sm">{revealed ? `${revealed} de ${total} cartas reveladas. Continue no seu ritmo.` : `${total} cartas preparadas. Revele uma de cada vez no seu ritmo.`}</p></div>
        <button type="button" onClick={() => { setPreparation((value) => value + 1); window.dispatchEvent(new CustomEvent("oracle-preparation", { detail: { sessionId: session.id } })); }} className="min-h-12 rounded-full border border-amber-300/50 px-4 py-2 text-xs font-medium text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">Rever preparação</button>
      </div>
      <div role="progressbar" aria-label="Cartas reveladas" aria-valuemin={0} aria-valuemax={total} aria-valuenow={revealed} className="scene-progress"><span style={{ width: `${total ? revealed / total * 100 : 0}%` }} /></div></>}
      {sound === null && !tabletop && <div className="flex flex-wrap gap-2 border-t border-white/10 bg-slate-950 px-4 pb-4 pt-3 sm:px-8" role="group" aria-label="Escolha de som da consulta">
        <button type="button" onClick={() => { setSoundPreference(true); playWelcome(true); }} className="min-h-12 rounded-full border border-amber-300/60 bg-amber-300/20 px-4 py-2 text-xs font-medium text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">Começar com som</button>
        <button type="button" onClick={() => setSoundPreference(false)} className="min-h-12 rounded-full border border-white/30 bg-slate-950/70 px-4 py-2 text-xs text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">Continuar sem som</button>
      </div>}
      {soundError && <span className="block px-4 pb-3 text-sm text-amber-100" role="status">{isLiveVoiceActive() ? "Encerre a conversa antes de ouvir o acolhimento." : "Toque em Ouvir acolhimento para iniciar o som."}</span>}
      {tabletop && <div className="scene-table scene-tabletop" data-table-open={tableOpen}>
        <button type="button" aria-expanded={tableOpen} aria-controls={`${panelId}-table`} onClick={() => setTableOpen((open) => !open)} className="scene-table-toggle flex min-h-12 w-full items-center justify-between px-4 text-left text-sm font-medium text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-300 lg:hidden">
          <span>{tableOpen ? "Ocultar visão geral" : `Ver mesa · ${total} cartas`}</span><span aria-hidden="true">{tableOpen ? "−" : "+"}</span>
        </button>
        <div id={`${panelId}-table`} className="scene-table-content">{children}</div>
      </div>}
      <audio ref={player} preload="none" src={`/audio/welcome-${deck}.wav`} onPlay={() => { setPlaying(true); window.dispatchEvent(new CustomEvent("oracle-audio-start",{detail:playerId})); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    </section>
    <ListeningDock session={session} />
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))] z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      <div id={panelId} hidden={!panelOpen} role="region" aria-label="Controles da consulta" onKeyDown={(event) => { if (event.key === "Escape") { setPanelOpen(false); avatarButton.current?.focus(); } }} className="max-h-[calc(100dvh-7rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-amber-300/40 bg-slate-950 p-4 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><h3 className="font-serif text-lg text-amber-100">Controles da consulta</h3><button type="button" onClick={() => { setPanelOpen(false); avatarButton.current?.focus(); }} className="min-h-12 px-2 text-xs underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">Fechar</button></div>
        <p className="mt-2 text-sm text-slate-300">{sound === null ? "Escolha como prefere acompanhar sua leitura." : sound ? "O som está ligado." : "O som está desligado."}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button ref={panelFirstButton} type="button" aria-pressed={sound === true} onClick={() => setSoundPreference(true)} className="min-h-12 rounded-full border border-amber-300/50 px-3 py-2 text-xs text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">Habilitar som</button>
          <button type="button" aria-pressed={sound === false} onClick={() => setSoundPreference(false)} className="min-h-12 rounded-full border border-white/30 px-3 py-2 text-xs text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">Desabilitar som</button>
        </div>
        <p className="mt-3 text-xs text-slate-400">Silenciar não encerra uma conversa em andamento.</p>
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-sm text-slate-200">Tamanho dos textos: {readingFontSize === 16 ? "menor" : readingFontSize === 18 ? "padrão" : readingFontSize === 20 ? "maior" : "extra grande"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Tamanho do texto da leitura">
            <button type="button" aria-label="Diminuir textos da consulta" disabled={readingFontSize === 16} onClick={() => changeReadingFontSize(Math.max(16, readingFontSize - 2))} className="min-h-12 rounded-full border border-white/30 px-4 text-sm disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">A−</button>
            <button type="button" aria-label="Aumentar textos da consulta" disabled={readingFontSize === 22} onClick={() => changeReadingFontSize(Math.min(22, readingFontSize + 2))} className="min-h-12 rounded-full border border-white/30 px-4 text-sm disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">A+</button>
            <button type="button" onClick={() => changeReadingFontSize(18)} className="min-h-12 rounded-full border border-white/30 px-3 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">Padrão</button>
          </div>
        </div>
        <SoundscapeControls persona={session.persona} sessionId={session.id} />
        {sound === true && <button type="button" onClick={() => playWelcome()} className="mt-3 block min-h-12 text-sm text-amber-200 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">{playing ? "Pausar acolhimento" : "Ouvir acolhimento"}</button>}
        {session.isPaid && revealed === total && <a href={`#oracle-live-${session.id}`} onClick={() => { setPanelOpen(false); const disclosure = document.getElementById(`oracle-live-${session.id}`)?.closest("details"); if (disclosure) disclosure.open = true; }} className="mt-3 flex min-h-12 items-center text-sm text-cyan-200 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">Ir para a conversa</a>}
        {onToggleImmersive && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={() => {
                setPanelOpen(false);
                onToggleImmersive();
              }}
              className="flex min-h-12 w-full items-center justify-center rounded-xl border border-amber-300/50 bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              Alternar para visão imersiva ↗
            </button>
          </div>
        )}
        {soundError && <p role="alert" className="mt-2 text-xs text-rose-300">{isLiveVoiceActive() ? "Encerre a conversa antes de ouvir o acolhimento." : "Áudio indisponível neste momento."}</p>}
      </div>
      <button ref={avatarButton} type="button" aria-label={`${panelOpen ? "Fechar" : "Abrir"} controles da consulta`} aria-expanded={panelOpen} aria-controls={panelId} onClick={() => setPanelOpen((open) => !open)} className="relative grid size-16 place-items-center rounded-full border-2 border-amber-300/70 bg-slate-950 shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300">
        <span ref={ring} aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full border-2 border-amber-200 opacity-0 transition-[transform,opacity] duration-75 motion-reduce:transition-none" />
        <Image src={art.close} alt="" width={56} height={56} className="size-14 rounded-full object-cover object-top" />
        <span aria-hidden="true" className="absolute -bottom-1 -right-1 rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">{sound === true ? "♪" : "×"}</span>
      </button>
    </div></>
  );
}


