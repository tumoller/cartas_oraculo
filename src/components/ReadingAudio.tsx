"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSoundPreference } from "@/lib/sound-preference";
import { isLiveVoiceActive, monitorMediaVoice, useFollowListening } from "@/lib/consultation-audio";

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
}: {
  sessionId: string;
  chapter: string;
  title?: string;
}) {
  const [audio, setAudio] = useState<ChapterAudio | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mediaError, setMediaError] = useState(false);
  const [pollingPaused, setPollingPaused] = useState(false);
  const pendingSince = useRef<number | null>(null);
  const player = useRef<HTMLAudioElement>(null);
  const playerId = useId();
  const soundEnabled = useSoundPreference();
  const followListening = useFollowListening();
  const endpoint = `/api/reading/${encodeURIComponent(sessionId)}/audio`;
  const statusUrl = `${endpoint}?chapter=${encodeURIComponent(chapter)}`;

  useEffect(() => {
    const element = player.current;
    if (!element) return;
    return monitorMediaVoice(element, "chapter", chapter);
  }, [chapter, audio?.status, soundEnabled]);

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

  useEffect(() => { if (soundEnabled !== true) player.current?.pause(); }, [soundEnabled]);

  const refresh = useCallback(async () => {
    const data = await audioRequest(statusUrl, { cache: "no-store" }) as ChapterAudio;
    setAudio(data as ChapterAudio);
    setError("");
    return data;
  }, [statusUrl]);

  useEffect(() => {
    let active = true;
    audioRequest(statusUrl, { cache: "no-store" })
      .then((data) => { if (active) setAudio(data as ChapterAudio); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Não foi possível consultar a narração."); });
    return () => { active = false; };
  }, [statusUrl]);

  useEffect(() => {
    if (audio?.status !== "pending" && audio?.status !== "generating") {
      pendingSince.current = null;
      return;
    }
    if (pendingSince.current === null) pendingSince.current = Date.now();
    if (pollingPaused) return;
    const remaining = Math.max(0, 60000 - (Date.now() - pendingSince.current));
    const timeout = window.setTimeout(() => setPollingPaused(true), remaining);
    const interval = window.setInterval(() => {
      refresh().catch(() => setError("Não foi possível atualizar a narração. Use Verificar narração para consultar novamente."));
    }, 5000);
    return () => { window.clearTimeout(timeout); window.clearInterval(interval); };
  }, [audio?.status, pollingPaused, refresh]);

  const verify = () => refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível verificar a narração."));

  const requestAudio = async () => {
    if (busy || soundEnabled !== true) return;
    setBusy(true);
    setError("");
    setPollingPaused(false);
    pendingSince.current = Date.now();
    setAudio((current) => ({ chapter, title: current?.title ?? title, status: "pending" }));
    try {
      const data = await audioRequest(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter }),
      });
      const queued = data.chapters?.find((item: ChapterAudio) => item.chapter === chapter);
      if (queued) setAudio(queued);
      await refresh();
    } catch {
      // A resposta do POST pode se perder após o servidor criar o job. Consulte o mesmo capítulo.
      try {
        const current = await refresh();
        if (current.status !== "ready") setError(current.status === "not_started"
          ? "Não foi possível confirmar o pedido. Verifique a narração antes de solicitar novamente."
          : "O pedido pode estar em andamento. Verifique a narração para acompanhar.");
      } catch {
        setError("Não foi possível confirmar o pedido. Verifique a narração antes de solicitar novamente.");
      }
    } finally {
      setBusy(false);
    }
  };

  const status = audio?.status;
  const url = audio?.url ?? `${endpoint}/${encodeURIComponent(chapter)}`;
  const waiting = status === "pending" || status === "generating";

  return (
    <div className="reading-audio my-4 rounded-xl bg-slate-950/35 p-3 sm:p-4" aria-live="polite">
      {soundEnabled !== true ? (
        <p className="text-sm text-slate-300">Ative o som no avatar para ouvir esta parte.</p>
      ) : status === "ready" ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Narração desta parte</p>
          <audio ref={player} controls preload="none" src={url} onPlay={(event) => {
            if (isLiveVoiceActive()) { event.currentTarget.pause(); setError("Encerre a conversa ao vivo antes de ouvir esta narração."); return; }
            setError("");
            window.dispatchEvent(new CustomEvent("oracle-audio-start", { detail: playerId }));
            if (followListening) window.dispatchEvent(new CustomEvent("oracle-chapter-focus", { detail: { sessionId, chapter } }));
          }} onError={() => setMediaError(true)} onCanPlay={() => setMediaError(false)} className="w-full max-w-md" aria-label={`Ouvir narração: ${audio?.title ?? title ?? chapter}`} />
          {mediaError && <p className="text-xs text-rose-300" role="alert">Não foi possível reproduzir este áudio. Verifique a narração e tente novamente.</p>}
          {mediaError && <button type="button" onClick={verify} className="text-xs text-amber-200 underline underline-offset-4">Verificar narração</button>}
          <a className="block w-fit text-xs text-slate-300 underline underline-offset-4 hover:text-white" href={audio?.downloadUrl ?? `${url}?download=1`} download>
            Baixar este áudio
          </a>
        </div>
      ) : waiting ? (
        <div className="space-y-2 text-sm text-slate-300" role="status">
          <p>{pollingPaused ? "A narração está demorando mais que o esperado. Você pode verificar o andamento." : "Preparando a narração desta parte…"}</p>
          {!pollingPaused && <div className="dealing-cards" aria-hidden="true"><span /><span /><span /></div>}
          {(pollingPaused || error) && <button type="button" onClick={verify} className="text-xs text-amber-200 underline underline-offset-4">Verificar narração</button>}
        </div>
      ) : status === "failed" ? (
        <div className="text-sm text-slate-300"><p>A narração desta parte não foi concluída. O texto da consulta continua disponível.</p><button type="button" onClick={verify} className="mt-2 text-xs underline text-amber-200">Verificar narração</button></div>
      ) : status ? (
        <button
          type="button"
          onClick={requestAudio}
          disabled={busy}
          className="min-h-12 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 disabled:opacity-50"
        >
          {title ? `Ouvir: ${title}` : "Ouvir esta parte"}
        </button>
      ) : error ? (
        <button type="button" onClick={verify} className="text-xs text-amber-200 underline underline-offset-4">
          Consultar novamente
        </button>
      ) : (
        <p className="text-xs text-slate-400">Consultando narração…</p>
      )}
      {error && <p className="mt-2 text-xs text-rose-300" role="alert">{error}</p>}
      <style jsx>{`
        .dealing-cards { display: flex; height: 28px; align-items: center; gap: 5px; }
        .dealing-cards span { width: 17px; height: 24px; border: 1px solid #fcd34d99; border-radius: 3px; background: #78350f99; animation: deal 1.5s ease-in-out infinite; }
        .dealing-cards span:nth-child(2) { animation-delay: .2s; }
        .dealing-cards span:nth-child(3) { animation-delay: .4s; }
        @keyframes deal { 0%, 70%, 100% { transform: translateX(0) rotate(0); opacity: .5; } 30% { transform: translateX(5px) rotate(8deg); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .dealing-cards span { animation: none; opacity: .8; } }
      `}</style>
    </div>
  );
}
