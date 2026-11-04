"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OraclePortrait } from "./OraclePortrait";
import { useSoundPreference } from "@/lib/sound-preference";
import {
  clearChapterRequested,
  clearChapterTime,
  getSavedChapterTime,
  hasRequestedChapter,
  isLiveVoiceActive,
  markChapterRequested,
  monitorMediaVoice,
  saveChapterTime,
  setChapterAudioState,
  useFollowListening,
} from "@/lib/consultation-audio";

type AudioStatus = "not_started" | "pending" | "generating" | "ready" | "failed";
type ChapterAudio = {
  chapter: string;
  title?: string;
  status: AudioStatus;
  url?: string;
  downloadUrl?: string;
};

async function audioRequest(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível consultar a narração.");
    return data;
  } finally {
    window.clearTimeout(timer);
  }
}

export function ReadingAudio({
  sessionId,
  chapter,
  title,
  persona,
  lineLabel,
  chapterText,
  prepare = false,
  autoPlay = false,
  playbackReady = true,
  headless = false,
  showPresentation = false,
  onOpenPresentation,
  onDismissPresentation,
  onAutoPlayConsumed,
  onEnded,
}: {
  sessionId: string;
  chapter: string;
  title?: string;
  persona?: string;
  lineLabel?: string;
  chapterText?: string;
  prepare?: boolean;
  autoPlay?: boolean;
  playbackReady?: boolean;
  headless?: boolean;
  showPresentation?: boolean;
  onOpenPresentation?: () => void;
  onDismissPresentation?: () => void;
  onAutoPlayConsumed?: () => void;
  onEnded?: () => void;
}) {
  const [audio, setAudio] = useState<ChapterAudio | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mediaError, setMediaError] = useState(false);
  const [pollingPaused, setPollingPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [elapsedOver10s, setElapsedOver10s] = useState(false);
  const [showText, setShowText] = useState(false);

  const pendingSince = useRef<number | null>(null);
  const player = useRef<HTMLAudioElement>(null);
  const presentationDialog = useRef<HTMLDialogElement>(null);
  const prepared = useRef(false);
  const requesting = useRef(false);
  const attemptedPlay = useRef("");
  const userPaused = useRef(false);
  const playWhenReady = useRef(false);
  const playerId = useId();
  const soundEnabled = useSoundPreference();
  useFollowListening();

  const endpoint = `/api/reading/${encodeURIComponent(sessionId)}/audio`;
  const statusUrl = `${endpoint}?chapter=${encodeURIComponent(chapter)}`;
  const onDismissPresentationRef = useRef(onDismissPresentation);
  useEffect(() => { onDismissPresentationRef.current = onDismissPresentation; });
  const onAutoPlayConsumedRef = useRef(onAutoPlayConsumed);
  useEffect(() => {
    onAutoPlayConsumedRef.current = onAutoPlayConsumed;
  });

  useEffect(() => {
    const element = player.current;
    if (!element) return;
    return monitorMediaVoice(element, "chapter", chapter, sessionId);
  }, [chapter, soundEnabled, sessionId, audio?.status]);

  useEffect(() => {
    const pauseOtherAudio = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== playerId) player.current?.pause();
    };
    const pauseAudio = () => player.current?.pause();
    window.addEventListener("oracle-audio-start", pauseOtherAudio);
    window.addEventListener("oracle-sound-off", pauseAudio);
    return () => {
      window.removeEventListener("oracle-audio-start", pauseOtherAudio);
      window.removeEventListener("oracle-sound-off", pauseAudio);
    };
  }, [playerId]);

  useEffect(() => {
    if (soundEnabled !== true) player.current?.pause();
  }, [soundEnabled]);

  const refresh = useCallback(async () => {
    const data = (await audioRequest(statusUrl, { cache: "no-store" })) as ChapterAudio;
    setAudio(data);
    setChapterAudioState(sessionId, chapter, { status: data.status });
    if (data.status === "not_started" || data.status === "failed") {
      clearChapterRequested(sessionId, chapter);
    } else if (data.status === "pending" || data.status === "generating" || data.status === "ready") {
      markChapterRequested(sessionId, chapter);
    }
    setError("");
    return data;
  }, [statusUrl, sessionId, chapter]);

  useEffect(() => {
    let active = true;
    audioRequest(statusUrl, { cache: "no-store" })
      .then((data) => {
        if (active) {
          const item = data as ChapterAudio;
          setAudio(item);
          setChapterAudioState(sessionId, chapter, { status: item.status });
          if (item.status === "not_started" || item.status === "failed") {
            clearChapterRequested(sessionId, chapter);
          } else if (item.status === "pending" || item.status === "generating" || item.status === "ready") {
            markChapterRequested(sessionId, chapter);
          }
        }
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível consultar a narração.");
      });
    return () => {
      active = false;
    };
  }, [statusUrl, sessionId, chapter]);

  useEffect(() => {
    const onReady = () => {
      void refresh();
    };
    window.addEventListener("oracle-audio-ready", onReady);
    return () => window.removeEventListener("oracle-audio-ready", onReady);
  }, [refresh]);

  useEffect(() => {
    if (audio?.status !== "pending" && audio?.status !== "generating") {
      pendingSince.current = null;
      return;
    }
    if (pendingSince.current === null) pendingSince.current = Date.now();
    const timer = window.setTimeout(() => setElapsedOver10s(true), 10000);

    if (pollingPaused) {
      return () => {
        window.clearTimeout(timer);
        setElapsedOver10s(false);
      };
    }
    const remaining = Math.max(0, 60000 - (Date.now() - pendingSince.current));
    const timeout = window.setTimeout(() => setPollingPaused(true), remaining);
    const interval = window.setInterval(() => {
      refresh().catch(() => setError("Não foi possível atualizar a narração. Use Verificar narração para consultar novamente."));
    }, 3500);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      setElapsedOver10s(false);
    };
  }, [audio?.status, pollingPaused, refresh]);

  const verify = () =>
    refresh().catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Não foi possível verificar a narração.")
    );

  const requestAudio = useCallback(async (force = false) => {
    if (requesting.current || (!force && soundEnabled !== true)) return;
    if (hasRequestedChapter(sessionId, chapter)) {
      try {
        const confirmed = await refresh();
        if (confirmed.status !== "not_started" && confirmed.status !== "failed") {
          return;
        }
      } catch {
        setError("Não foi possível confirmar o pedido. Verifique a narração antes de solicitar novamente.");
        return;
      }
    }
    markChapterRequested(sessionId, chapter);
    requesting.current = true;
    prepared.current = true;
    setBusy(true);
    setError("");
    setPollingPaused(false);
    pendingSince.current = Date.now();
    setAudio((current) => ({ chapter, title: current?.title ?? title, status: "pending" }));
    setChapterAudioState(sessionId, chapter, { status: "pending" });
    try {
      const data = await audioRequest(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter }),
      });
      const queued = data.chapters?.find((item: ChapterAudio) => item.chapter === chapter);
      if (queued) {
        setAudio(queued);
        setChapterAudioState(sessionId, chapter, { status: queued.status });
      }
      await refresh();
    } catch {
      try {
        const current = await refresh();
        if (current.status !== "ready") {
          setError(
            current.status === "not_started"
              ? "Não foi possível confirmar o pedido. Tente novamente ou verifique a narração."
              : current.status === "failed"
              ? "A preparação falhou no servidor. Você pode tentar novamente."
              : "O pedido pode estar em andamento. Verifique a narração para acompanhar."
          );
        }
      } catch {
        setError("Não foi possível confirmar o pedido. Verifique a narração antes de solicitar novamente.");
      }
    } finally {
      requesting.current = false;
      setBusy(false);
    }
  }, [soundEnabled, chapter, title, endpoint, refresh, sessionId]);

  useEffect(() => {
    if (!prepare || soundEnabled !== true || audio?.status !== "not_started" || prepared.current) return;
    prepared.current = true;
    void requestAudio();
  }, [prepare, soundEnabled, audio?.status, requestAudio]);

  const status = audio?.status;
  const url = audio?.url ?? `${endpoint}/${encodeURIComponent(chapter)}`;
  const waiting = status === "pending" || status === "generating";

  // Direct request from ConsultationImmersive button click
  useEffect(() => {
    const onImmersivePlay = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId: string; chapter: string }>).detail;
      if (detail?.sessionId !== sessionId || detail.chapter !== chapter) return;
      userPaused.current = false;
      playWhenReady.current = true;
      if (status === "ready" && player.current) {
        playWhenReady.current = false;
        void player.current.play().catch(() => {
          setAutoplayBlocked(true);
        });
      } else if (status === "not_started" || status === "failed" || !status) {
        void requestAudio(true);
      } else {
        void refresh();
      }
    };
    window.addEventListener("oracle-immersive-play-request", onImmersivePlay);
    return () => window.removeEventListener("oracle-immersive-play-request", onImmersivePlay);
  }, [sessionId, chapter, status, requestAudio, refresh]);

  useEffect(() => {
    const shouldPlay = autoPlay || playWhenReady.current;
    if (!shouldPlay || !playbackReady || soundEnabled !== true || isLiveVoiceActive()) return;
    if (userPaused.current) {
      playWhenReady.current = false;
      onAutoPlayConsumedRef.current?.();
      return;
    }
    if (status !== "ready" || !player.current) {
      if ((status === "not_started" || status === "failed") && !requesting.current) {
        void requestAudio(true);
      }
      return;
    }
    if (attemptedPlay.current === url && !playWhenReady.current) {
      onAutoPlayConsumedRef.current?.();
      return;
    }

    attemptedPlay.current = url;
    playWhenReady.current = false;
    onAutoPlayConsumedRef.current?.();

    player.current
      .play()
      .then(() => {
        setError("");
        setAutoplayBlocked(false);
      })
      .catch(() => {
        setAutoplayBlocked(true);
        if (!headless) onOpenPresentation?.();
        setError("O navegador pediu um toque para iniciar a narração. Toque em Reproduzir narração.");
      });
  }, [autoPlay, playbackReady, soundEnabled, status, url, onOpenPresentation, requestAudio, headless]);

  const resumeAudio = () => {
    if (!playbackReady || isLiveVoiceActive()) return;
    userPaused.current = false;
    void player.current
      ?.play()
      .then(() => {
        setError("");
        setAutoplayBlocked(false);
      })
      .catch(() => setError("Não foi possível iniciar a narração neste dispositivo."));
  };

  useEffect(() => {
    const el = presentationDialog.current;
    if (!el || !showPresentation) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    let reopening = false;
    const open = () => desktop.matches ? el.show() : el.showModal();
    const dismiss = () => {
      if (reopening) { reopening = false; return; }
      onDismissPresentationRef.current?.();
    };
    const resize = () => {
      reopening = true;
      el.close();
      open();
    };
    el.addEventListener("close", dismiss);
    open();
    desktop.addEventListener("change", resize);
    return () => {
      desktop.removeEventListener("change", resize);
      el.removeEventListener("close", dismiss);
      if (el.open) el.close();
    };
  }, [showPresentation]);

  const audioEl = (
      <audio
        ref={player}
        controls={!headless}
        preload={getSavedChapterTime(sessionId, chapter) > 0 ? "metadata" : "none"}
        src={url}
        onLoadedMetadata={(event) => {
          const saved = getSavedChapterTime(sessionId, chapter);
          if (saved > 0 && event.currentTarget.duration > 0 && saved < event.currentTarget.duration) {
            if (Math.abs(event.currentTarget.currentTime - saved) > 0.3) {
              event.currentTarget.currentTime = saved;
            }
          }
        }}
        onTimeUpdate={(event) => {
          if (event.currentTarget.currentTime > 0) {
            saveChapterTime(sessionId, chapter, event.currentTarget.currentTime);
          }
        }}
        onPlay={(event) => {
          if (!playbackReady || isLiveVoiceActive()) {
            event.currentTarget.pause();
            setError(
              isLiveVoiceActive()
                ? "Encerre a conversa ao vivo antes de ouvir esta narração."
                : "A narração desta parte ainda não pode ser reproduzida."
            );
            return;
          }
          userPaused.current = false;
          setIsPlaying(true);
          setAutoplayBlocked(false);
          setChapterAudioState(sessionId, chapter, { status: "ready", hasPlayed: true, userPaused: false });
          setError("");
          window.dispatchEvent(new CustomEvent("oracle-audio-start", { detail: playerId }));
        }}
        onPause={() => {
          setIsPlaying(false);
          if (player.current && !player.current.ended && soundEnabled === true) {
            userPaused.current = true;
            saveChapterTime(sessionId, chapter, player.current.currentTime);
            setChapterAudioState(sessionId, chapter, { status: "ready", userPaused: true });
            onAutoPlayConsumedRef.current?.();
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setChapterAudioState(sessionId, chapter, { status: "ready", hasPlayed: true });
          clearChapterTime(sessionId, chapter);
          onEnded?.();
          window.dispatchEvent(new CustomEvent("oracle-chapter-ended", { detail: { sessionId, chapter } }));
        }}
        onError={() => {
          setIsPlaying(false);
          setMediaError(true);
        }}
        onCanPlay={() => {
          setMediaError(false);
          const saved = getSavedChapterTime(sessionId, chapter);
          if (saved > 0 && player.current && player.current.duration > 0 && saved < player.current.duration) {
            if (Math.abs(player.current.currentTime - saved) > 0.3) {
              player.current.currentTime = saved;
            }
          }
        }}
        className={headless ? undefined : "w-full max-w-md"}
        aria-label={`Ouvir narração: ${audio?.title ?? title ?? chapter}`}
      />
  );

  if (headless) {
    // Keep the element mounted regardless of the sound preference so a tap that turns sound on can play in the same gesture.
    const ready = playbackReady && status === "ready";
    return ready ? <div hidden aria-hidden="true">{audioEl}</div> : null;
  }

  const displayTitle = lineLabel || title || "Leitura da linha";

  return (
    <>
      {showPresentation && typeof document !== "undefined" && createPortal(
        <dialog
          ref={presentationDialog}
          aria-labelledby="narration-presentation-title"
          className="narration-presentation fixed inset-0 m-auto max-h-[94dvh] w-[min(calc(100vw-1rem),700px)] overflow-y-auto rounded-3xl border border-amber-400/40 bg-slate-950 p-3 text-slate-100 shadow-2xl backdrop:bg-slate-950/85"
        >
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4 h-[45dvh] min-h-48 w-full overflow-hidden rounded-2xl border border-amber-300/30">
              <OraclePortrait persona={persona || "Oráculo da Galáxia"} preparing={waiting} playing={isPlaying} />
            </div>
            <h3 id="narration-presentation-title" className="font-serif text-xl text-amber-100">
              {displayTitle}
            </h3>

            {playbackReady && chapterText && <div className="mt-2 w-full text-left"><button type="button" className="min-h-11 text-sm text-amber-200 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300" aria-expanded={showText} aria-controls={`${playerId}-text`} onClick={() => setShowText(!showText)}>{showText ? "Ocultar texto" : "Acompanhar o texto desta leitura"}</button>{showText && <div id={`${playerId}-text`} tabIndex={0} aria-label="Texto desta leitura" className="max-h-32 overflow-y-auto whitespace-pre-line rounded-lg bg-slate-900 p-3 text-sm leading-relaxed text-slate-100">{chapterText}</div>}</div>}
            {status === "ready" ? (
              <div className="mt-3 flex w-full flex-col items-center gap-3">
                {isPlaying ? (
                  <div className="flex items-center gap-2 text-sm text-cyan-200">
                    <span className="inline-block size-2 rounded-full bg-cyan-400 motion-safe:animate-pulse" />
                    <span>Ouvindo a narração</span>
                  </div>
                ) : autoplayBlocked ? (
                  <p className="text-sm text-amber-200">Toque abaixo para iniciar a narração.</p>
                ) : (
                  <p className="text-sm text-slate-300">Narração pronta.</p>
                )}

                <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                  {autoplayBlocked ? (
                    <button
                      type="button"
                      onClick={resumeAudio}
                      className="min-h-12 flex-1 rounded-xl border border-amber-400 bg-amber-400/20 px-4 py-2.5 text-sm font-semibold text-amber-100 shadow-md hover:bg-amber-400/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                    >
                      Tocar leitura
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (player.current && !player.current.paused) {
                          player.current.pause();
                          setIsPlaying(false);
                        } else {
                          setIsPlaying(false);
                          resumeAudio();
                        }
                      }}
                      className="min-h-12 flex-1 rounded-xl border border-amber-400/50 bg-amber-400/20 px-4 py-2.5 text-sm font-semibold text-amber-100 shadow-md hover:bg-amber-400/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                    >
                      {isPlaying ? "Pausar leitura" : "Continuar leitura"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDismissPresentation?.()}
                    className="min-h-12 flex-1 rounded-xl border border-white/20 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40"
                  >
                    Sair da imersão
                  </button>
                </div>
              </div>
            ) : waiting ? (
              <div className="mt-3 flex w-full flex-col items-center gap-3">
                <p className="text-sm leading-relaxed text-slate-200">
                  {elapsedOver10s
                    ? "A narração ainda está sendo preparada. Você pode aguardar ou continuar pelo texto."
                    : "Estou preparando a leitura desta linha…"}
                </p>
                {!elapsedOver10s && (
                  <div className="dealing-cards" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                )}
                <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() => onDismissPresentation?.()}
                    className="min-h-12 flex-1 rounded-xl border border-white/20 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40"
                  >
                    Sair da imersão
                  </button>
                  {(elapsedOver10s || pollingPaused || error) && (
                    <button
                      type="button"
                      onClick={verify}
                      className="min-h-12 rounded-xl border border-amber-400/40 px-4 py-2.5 text-xs text-amber-200 underline underline-offset-4"
                    >
                      Verificar narração
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3 flex w-full flex-col items-center gap-3">
                <p className="text-sm text-rose-300">
                  {error || "A narração desta parte não foi concluída. O texto da consulta continua disponível."}
                </p>
                <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                  {(status === "not_started" || status === "failed") && (
                    <button
                      type="button"
                      onClick={() => void requestAudio(true)}
                      disabled={busy}
                      className="min-h-12 flex-1 rounded-xl border border-amber-400/50 bg-amber-400/20 px-4 py-2.5 text-sm font-semibold text-amber-100 shadow-md hover:bg-amber-400/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 disabled:opacity-50"
                    >
                      Tentar novamente
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={verify}
                    className="min-h-12 flex-1 rounded-xl border border-amber-400/50 bg-amber-400/20 px-4 py-2.5 text-sm font-semibold text-amber-100 shadow-md hover:bg-amber-400/30"
                  >
                    Verificar narração
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismissPresentation?.()}
                    className="min-h-12 flex-1 rounded-xl border border-white/20 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
                  >
                    Sair da imersão
                  </button>
                </div>
              </div>
            )}
          </div>
        </dialog>, document.body
      )}

      <div className="reading-audio my-4 rounded-xl bg-slate-950/35 p-3 sm:p-4" aria-live="polite">
        {playbackReady && soundEnabled === true && !showPresentation && onOpenPresentation && (
          <button type="button" onClick={onOpenPresentation} className="mb-3 min-h-12 rounded-xl border border-amber-400/50 px-4 text-sm font-semibold text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
            Voltar à imersão
          </button>
        )}
        {soundEnabled !== true ? (
          <p className="text-sm text-slate-300">Ative o som no avatar para ouvir esta parte.</p>
        ) : !playbackReady ? (
          <p className="text-sm text-slate-300">A narração ficará disponível quando esta parte da leitura for revelada.</p>
        ) : status === "ready" ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Narração desta parte</p>
            {audioEl}
            {error && (
              <button
                type="button"
                onClick={resumeAudio}
                className="min-h-12 rounded-xl border border-amber-400/40 px-4 text-sm font-semibold text-amber-200"
              >
                Reproduzir narração
              </button>
            )}
            {mediaError && (
              <p className="text-xs text-rose-300" role="alert">
                Não foi possível reproduzir este áudio. Verifique a narração e tente novamente.
              </p>
            )}
            {mediaError && (
              <button type="button" onClick={verify} className="text-xs text-amber-200 underline underline-offset-4">
                Verificar narração
              </button>
            )}
            <a
              className="block w-fit text-xs text-slate-300 underline underline-offset-4 hover:text-white"
              href={audio?.downloadUrl ?? `${url}?download=1`}
              download
            >
              Baixar este áudio
            </a>
          </div>
        ) : waiting ? (
          <div className="space-y-2 text-sm text-slate-300" role="status">
            <p>
              {pollingPaused
                ? "A narração está demorando mais que o esperado. Você pode verificar o andamento."
                : "Preparando a narração desta parte…"}
            </p>
            {!pollingPaused && (
              <div className="dealing-cards" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            )}
            {(pollingPaused || error) && (
              <button type="button" onClick={verify} className="text-xs text-amber-200 underline underline-offset-4">
                Verificar narração
              </button>
            )}
          </div>
        ) : status === "failed" ? (
          <div className="text-sm text-slate-300">
            <p>A narração desta parte não foi concluída. O texto da consulta continua disponível.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void requestAudio(true)}
                disabled={busy}
                className="min-h-12 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 disabled:opacity-50"
              >
                Tentar novamente
              </button>
              <button type="button" onClick={verify} className="text-xs text-amber-200 underline underline-offset-4">
                Verificar narração
              </button>
            </div>
          </div>
        ) : status ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void requestAudio(true)}
              disabled={busy}
              className="min-h-12 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 disabled:opacity-50"
            >
              {error ? "Tentar novamente" : title ? `Ouvir: ${title}` : "Ouvir esta parte"}
            </button>
            {error && (
              <button type="button" onClick={verify} className="text-xs text-amber-200 underline underline-offset-4">
                Verificar narração
              </button>
            )}
          </div>
        ) : error ? (
          <button type="button" onClick={verify} className="text-xs text-amber-200 underline underline-offset-4">
            Consultar novamente
          </button>
        ) : (
          <p className="text-xs text-slate-400">Consultando narração…</p>
        )}
        {error && <p className="mt-2 text-xs text-rose-300" role="alert">{error}</p>}
        <style jsx>{`
          .dealing-cards {
            display: flex;
            height: 28px;
            align-items: center;
            gap: 5px;
          }
          .dealing-cards span {
            width: 17px;
            height: 24px;
            border: 1px solid #fcd34d99;
            border-radius: 3px;
            background: #78350f99;
            animation: deal 1.5s ease-in-out infinite;
          }
          .dealing-cards span:nth-child(2) {
            animation-delay: 0.2s;
          }
          .dealing-cards span:nth-child(3) {
            animation-delay: 0.4s;
          }
          @keyframes deal {
            0%,
            70%,
            100% {
              transform: translateX(0) rotate(0);
              opacity: 0.5;
            }
            30% {
              transform: translateX(5px) rotate(8deg);
              opacity: 1;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .dealing-cards span {
              animation: none;
              opacity: 0.8;
            }
          }
        `}</style>
      </div>
    </>
  );
}
