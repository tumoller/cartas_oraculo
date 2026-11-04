"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { ReadingSessionPayload } from "@/types";
import { sceneAssets } from "@/lib/scene-assets";
import { canResumeCurrentVoice, getVoiceState, isLiveVoiceActive, pauseCurrentVoice, resumeCurrentVoice, setFollowListening, useFollowListening, type VoiceState } from "@/lib/consultation-audio";
import { useSoundPreference } from "@/lib/sound-preference";

export function ListeningDock({ session }: { session: ReadingSessionPayload }) {
  const [voice, setVoice] = useState<VoiceState | null>(null);
  const [resumeError, setResumeError] = useState(false);
  const follow = useFollowListening();
  const soundEnabled = useSoundPreference() === true;

  useEffect(() => {
    const initial = getVoiceState();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoice(
      isLiveVoiceActive()
        ? { active: true, kind: "live" }
        : initial?.active || (initial?.kind === "chapter" && canResumeCurrentVoice())
        ? initial
        : null
    );
    const changed = (event: Event) => {
      const next = (event as CustomEvent<VoiceState>).detail;
      setVoice(
        next.active || (next.kind === "chapter" && canResumeCurrentVoice()) || isLiveVoiceActive()
          ? next
          : null
      );
    };
    const liveChanged = () => {
      if (isLiveVoiceActive()) { setVoice({ active: true, kind: "live" }); return; }
      const latest = getVoiceState();
      if (latest?.kind === "live" || (!latest?.active && !canResumeCurrentVoice())) setVoice(null);
    };
    window.addEventListener("oracle-voice-state", changed);
    window.addEventListener("oracle-live-state", liveChanged);
    return () => {
      window.removeEventListener("oracle-voice-state", changed);
      window.removeEventListener("oracle-live-state", liveChanged);
    };
  }, []);

  // Continuous auto-follow sync when option is enabled
  useEffect(() => {
    if (follow && voice?.active && voice.kind === "chapter" && voice.chapter) {
      window.dispatchEvent(
        new CustomEvent("oracle-chapter-focus", {
          detail: { sessionId: session.id, chapter: voice.chapter },
        })
      );
    }
  }, [follow, voice?.active, voice?.kind, voice?.chapter, session.id]);

  if (!voice) return null;
  const title = voice.kind === "chapter" ? `Ouvindo ${voice.chapter === "synthesis" ? "a síntese" : voice.chapter?.replace(/^(card|section)/, "parte ") ?? "a narração"}` : voice.kind === "welcome" ? "Acolhimento" : "Conversa ao vivo";
  const action = voice.active ? "Pausar áudio" : voice.kind === "welcome" ? "Ouvir acolhimento" : "Retomar áudio";
  const art = sceneAssets(session.persona);

  return (
    <aside className="fixed bottom-[calc(1.1rem+env(safe-area-inset-bottom))] left-3 right-20 z-40 mx-auto max-w-sm rounded-2xl border border-amber-300/50 bg-slate-950/95 text-white shadow-xl backdrop-blur sm:bottom-6 sm:left-auto sm:right-24 sm:mx-0 sm:w-80" aria-label="Painel de escuta">
      <div className="flex min-h-12 items-center gap-2 px-3">
        <Image src={art.close} alt="" width={36} height={36} className="size-9 shrink-0 rounded-full object-cover object-top" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-amber-100">{title}</p>
        {voice.kind !== "live" ? <button type="button" disabled={!voice.active && (!soundEnabled || !canResumeCurrentVoice())} onClick={() => voice.active ? pauseCurrentVoice() : void resumeCurrentVoice(soundEnabled).catch(() => setResumeError(true))} className="min-h-12 shrink-0 px-2 text-sm underline underline-offset-4 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">{action}</button> : <span className="text-xs text-cyan-200">Ao vivo</span>}
      </div>
      {voice.kind === "chapter" && (
        <details className="border-t border-white/10 px-3 py-1 text-sm text-slate-200">
          <summary className="min-h-10 cursor-pointer py-2">Opções de escuta</summary>
          <div className="pb-3 space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={follow}
                onChange={(event) => {
                  setFollowListening(event.target.checked);
                  if (event.target.checked && voice.active) {
                    window.dispatchEvent(new CustomEvent("oracle-chapter-focus", { detail: { sessionId: session.id, chapter: voice.chapter } }));
                  }
                }}
                className="size-4 accent-amber-300"
              />
              <span>Acompanhar trecho na tela</span>
            </label>
            <button
              type="button"
              onClick={() => {
                if (voice.chapter) {
                  window.dispatchEvent(
                    new CustomEvent("oracle-chapter-focus", {
                      detail: { sessionId: session.id, chapter: voice.chapter },
                    })
                  );
                }
              }}
              className="block text-xs text-amber-200 underline underline-offset-4"
            >
              Abrir capítulo narrado
            </button>
          </div>
        </details>
      )}
      {resumeError && <p role="alert" className="px-3 pb-2 text-xs text-rose-300">Toque no player para ouvir.</p>}
    </aside>
  );
}
