"use client";

import { useEffect, useRef, useState } from "react";
import { useSoundPreference } from "@/lib/sound-preference";
import { ambientPlaybackVolume, getVoiceVolume, setVoiceVolume, soundscapeAssets } from "@/lib/soundscape";
import { getVoiceState, setFollowListening, useFollowListening } from "@/lib/consultation-audio";

export function SoundscapeControls({ persona, sessionId }: { persona: string; sessionId: string }) {
  const deck = persona === "Linha de Umbanda" ? "umbanda" : persona === "Cigana Tradicional" ? "cigano" : "cosmico";
  const ambientUrl = soundscapeAssets.ambience[deck];
  const sound = useSoundPreference();
  const follow = useFollowListening();
  const [voiceVolume, updateVoiceVolume] = useState(1);
  const [ambientVolume, setAmbientVolume] = useState(0.2);
  const [ambientOn, setAmbientOn] = useState(false);
  const [effectsOn, setEffectsOn] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const background = useRef<HTMLAudioElement | null>(null);
  const voiceActive = useRef(false);
  const microphone = useRef(false);
  const effects = useRef(new Set<HTMLAudioElement>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const enabled = useRef(false);
  enabled.current = sound === true;

  useEffect(() => updateVoiceVolume(getVoiceVolume()), []);

  useEffect(() => {
    const update = () => {
      const player = background.current;
      if (!player) return;
      player.volume = ambientPlaybackVolume(ambientVolume, voiceActive.current, microphone.current, enabled.current && ambientOn);
      if (!enabled.current || !ambientOn || microphone.current) player.pause();
      else void player.play().catch(() => setUnavailable(true));
    };
    const voice = (event: Event) => { voiceActive.current = Boolean((event as CustomEvent).detail?.active); update(); };
    const mic = (event: Event) => { microphone.current = Boolean((event as CustomEvent).detail?.active); update(); };
    const off = () => {
      background.current?.pause();
      effects.current.forEach((player) => player.pause());
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setAmbientOn(false);
    };
    update();
    window.addEventListener("oracle-voice-state", voice);
    window.addEventListener("oracle-microphone", mic);
    window.addEventListener("oracle-sound-off", off);
    return () => {
      window.removeEventListener("oracle-voice-state", voice);
      window.removeEventListener("oracle-microphone", mic);
      window.removeEventListener("oracle-sound-off", off);
    };
  }, [ambientOn, ambientVolume, sound]);

  useEffect(() => {
    const play = (kind: keyof typeof soundscapeAssets.effects) => {
      const url = soundscapeAssets.effects[kind];
      if (!url || !enabled.current || !effectsOn || microphone.current) return;
      const player = new Audio(url);
      player.volume = 0.22;
      effects.current.add(player);
      const release = () => { effects.current.delete(player); };
      player.onended = release;
      player.onerror = release;
      void player.play().catch(release);
    };
    const reveal = (event: Event) => {
      if ((event as CustomEvent).detail?.sessionId !== sessionId) return;
      play("flip");
      timers.current.push(setTimeout(() => play("place"), 420));
    };
    const prepare = (event: Event) => {
      if ((event as CustomEvent).detail?.sessionId === sessionId) play("shuffle");
    };
    window.addEventListener("oracle-reveal", reveal);
    window.addEventListener("oracle-preparation", prepare);
    return () => {
      window.removeEventListener("oracle-reveal", reveal);
      window.removeEventListener("oracle-preparation", prepare);
      timers.current.forEach(clearTimeout);
      timers.current = [];
      effects.current.forEach((player) => player.pause());
      effects.current.clear();
    };
  }, [effectsOn, sessionId]);

  useEffect(() => () => { background.current?.pause(); }, []);

  const toggleAmbient = () => {
    if (!ambientUrl || sound !== true) return;
    if (!background.current) {
      background.current = new Audio(ambientUrl);
      background.current.loop = true;
      background.current.onerror = () => setUnavailable(true);
    }
    if (!ambientOn) {
      background.current.volume = ambientPlaybackVolume(ambientVolume, voiceActive.current, microphone.current, true);
      if (!microphone.current) void background.current.play().catch(() => setUnavailable(true));
    } else background.current.pause();
    setAmbientOn(!ambientOn);
  };

  return <div className="mt-4 space-y-3 border-t border-white/10 pt-3 text-sm">
    <label className="flex min-h-12 items-center gap-2"><input type="checkbox" checked={follow} onChange={(event) => {
      setFollowListening(event.target.checked);
      const current = getVoiceState();
      if (event.target.checked && current?.active && current.kind === "chapter") window.dispatchEvent(new CustomEvent("oracle-chapter-focus", { detail: { sessionId, chapter: current.chapter } }));
    }} className="size-4 accent-amber-300" />Acompanhar ouvindo</label>
    <label className="block">Volume da voz
      <input type="range" min="0" max="1" step="0.05" value={voiceVolume} onChange={(event) => { const value = Number(event.target.value); updateVoiceVolume(value); setVoiceVolume(value); }} className="mt-2 block h-8 w-full accent-amber-300" />
    </label>
    {ambientUrl && <>
      <button type="button" onClick={toggleAmbient} disabled={sound !== true} aria-pressed={ambientOn} className="min-h-12 rounded-full border border-white/30 px-3 disabled:opacity-40">{ambientOn ? "Desligar ambiente" : "Ouvir ambiente"}</button>
      <label className="block">Volume do ambiente<input type="range" min="0" max="0.5" step="0.025" value={ambientVolume} onChange={(event) => setAmbientVolume(Number(event.target.value))} className="mt-2 block h-8 w-full accent-amber-300" /></label>
    </>}
    {Object.values(soundscapeAssets.effects).some(Boolean) && <button type="button" aria-pressed={effectsOn} onClick={() => setEffectsOn(!effectsOn)} className="min-h-12 rounded-full border border-white/30 px-3">{effectsOn ? "Silenciar cartas" : "Ouvir cartas"}</button>}
    {unavailable && <p role="status" className="text-xs text-slate-300">O som do ambiente não está disponível agora. Sua leitura continua normalmente.</p>}
  </div>;
}
