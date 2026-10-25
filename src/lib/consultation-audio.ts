"use client";

import { useSyncExternalStore } from "react";
import { getVoiceVolume } from "@/lib/soundscape";

export type VoiceKind = "welcome" | "chapter" | "live";
export type VoiceState = { active: boolean; kind: VoiceKind; chapter?: string };

let currentMedia: HTMLAudioElement | null = null;
let lastMedia: HTMLAudioElement | null = null;
// ponytail: one reusable media context per tab; avoid a context per chapter on mobile.
let mediaContext: AudioContext | null = null;
const mediaGraphs = new WeakMap<HTMLAudioElement, { source: MediaElementAudioSourceNode; analyser: AnalyserNode; connected: boolean }>();
let liveActive = false;
let lastVoice: VoiceState | null = null;
const followKey = "oracle_follow_listening";
const followEvent = "oracle-follow-listening";
let followFallback = false;

function voiceState(detail: VoiceState) {
  lastVoice = detail;
  window.dispatchEvent(new CustomEvent("oracle-voice-state", { detail }));
}

function voiceLevel(level: number) {
  window.dispatchEvent(new CustomEvent("oracle-voice-level", { detail: { level } }));
}

export function isLiveVoiceActive() { return liveActive; }
export function getVoiceState() { return lastVoice; }
export function canResumeCurrentVoice() { return !!lastMedia && !lastMedia.ended; }
export function pauseCurrentVoice() { currentMedia?.pause(); }
export function resumeCurrentVoice(soundEnabled: boolean) {
  if (soundEnabled && !liveActive && lastMedia) return lastMedia.play();
  return Promise.resolve();
}

export function setLiveVoiceActive(active: boolean) {
  liveActive = active;
  if (active) currentMedia?.pause();
  window.dispatchEvent(new CustomEvent("oracle-live-state", { detail: { active } }));
}

export function monitorMediaVoice(element: HTMLAudioElement, kind: "welcome" | "chapter", chapter?: string) {
  let analyser: AnalyserNode | null = null;
  let frame = 0;
  const samples = new Uint8Array(256);
  const stopMeter = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (currentMedia === element) {
      currentMedia = null;
      voiceLevel(0);
      voiceState({ active: false, kind, chapter });
      queueMicrotask(() => {
        if (!currentMedia && mediaContext?.state === "running") void mediaContext.suspend().catch(() => {});
      });
    }
  };
  const sample = () => {
    if (element.paused || !analyser) { stopMeter(); return; }
    analyser.getByteTimeDomainData(samples);
    let energy = 0;
    for (let i = 0; i < samples.length; i++) energy += ((samples[i] - 128) / 128) ** 2;
    voiceLevel(Math.min(1, Math.sqrt(energy / samples.length) * 4));
    frame = requestAnimationFrame(sample);
  };
  const onPlay = () => {
    if (liveActive) { element.pause(); return; }
    if (currentMedia && currentMedia !== element) currentMedia.pause();
    currentMedia = element;
    lastMedia = element;
    if (!analyser && typeof AudioContext !== "undefined") {
      try {
        mediaContext ??= new AudioContext();
        let graph = mediaGraphs.get(element);
        if (!graph) {
          const source = mediaContext.createMediaElementSource(element);
          const meter = mediaContext.createAnalyser();
          meter.fftSize = 256;
          graph = { source, analyser: meter, connected: false };
          mediaGraphs.set(element, graph);
        }
        if (!graph.connected) {
          graph.source.connect(graph.analyser);
          graph.analyser.connect(mediaContext.destination);
          graph.connected = true;
        }
        analyser = graph.analyser;
      } catch { /* Browser may deny metering; ordinary playback still works. */ }
    }
    if (mediaContext?.state === "suspended") void mediaContext.resume().catch(() => {});
    voiceState({ active: true, kind, chapter });
    if (!frame && analyser) frame = requestAnimationFrame(sample);
  };
  const onVolume = () => { element.volume = getVoiceVolume(); };
  const onEnded = () => { if (lastMedia === element) lastMedia = null; stopMeter(); voiceState({ active: false, kind, chapter }); };
  onVolume();
  element.addEventListener("play", onPlay);
  element.addEventListener("pause", stopMeter);
  element.addEventListener("ended", onEnded);
  window.addEventListener("oracle-voice-volume", onVolume);
  if (!element.paused) onPlay();
  return () => {
    element.pause();
    element.removeEventListener("play", onPlay);
    element.removeEventListener("pause", stopMeter);
    element.removeEventListener("ended", onEnded);
    window.removeEventListener("oracle-voice-volume", onVolume);
    const removedPausedPlayer = lastMedia === element && currentMedia !== element;
    if (lastMedia === element) lastMedia = null;
    stopMeter();
    if (removedPausedPlayer) voiceState({ active: false, kind, chapter });
    const graph = mediaGraphs.get(element);
    if (graph?.connected) {
      graph.source.disconnect();
      graph.analyser.disconnect();
      graph.connected = false;
    }
  };
}

export function monitorLiveVoice(analyser: AnalyserNode) {
  let frame = 0;
  const samples = new Uint8Array(256);
  const sample = () => {
    analyser.getByteTimeDomainData(samples);
    let energy = 0;
    for (let i = 0; i < samples.length; i++) energy += ((samples[i] - 128) / 128) ** 2;
    voiceLevel(Math.min(1, Math.sqrt(energy / samples.length) * 4));
    frame = requestAnimationFrame(sample);
  };
  voiceState({ active: true, kind: "live" });
  frame = requestAnimationFrame(sample);
  return () => {
    cancelAnimationFrame(frame);
    voiceLevel(0);
    voiceState({ active: false, kind: "live" });
  };
}

function readFollow() {
  try { return localStorage.getItem(followKey) === "on"; } catch { return followFallback; }
}

function subscribeFollow(notify: () => void) {
  window.addEventListener(followEvent, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(followEvent, notify); window.removeEventListener("storage", notify); };
}

export function useFollowListening() {
  return useSyncExternalStore(subscribeFollow, readFollow, () => false);
}

export function setFollowListening(enabled: boolean) {
  followFallback = enabled;
  try { localStorage.setItem(followKey, enabled ? "on" : "off"); } catch { /* Private browsing. */ }
  window.dispatchEvent(new Event(followEvent));
}
