// Only add local files here after their sound and commercial rights are approved.
// Null entries never cause a download or synthetic replacement.
export const soundscapeAssets: {
  effects: Record<"shuffle" | "place" | "flip", string | null>;
  ambience: Record<"cosmico" | "cigano" | "umbanda", string | null>;
} = {
  effects: { shuffle: null, place: null, flip: null },
  ambience: { cosmico: null, cigano: null, umbanda: null },
};

let voiceFallback = 1;

export function getVoiceVolume(): number {
  try {
    const saved = localStorage.getItem("oracle_voice_volume");
    const value = saved === null ? voiceFallback : Number(saved);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
  } catch { return voiceFallback; }
}

export function setVoiceVolume(volume: number): void {
  const value = Math.max(0, Math.min(1, volume));
  voiceFallback = value;
  try { localStorage.setItem("oracle_voice_volume", String(value)); } catch { /* Optional preference. */ }
  window.dispatchEvent(new CustomEvent("oracle-voice-volume", { detail: { volume: value } }));
}

export function ambientPlaybackVolume(volume: number, voice: boolean, microphone: boolean, enabled: boolean): number {
  return !enabled || microphone ? 0 : Math.max(0, Math.min(1, volume)) * (voice ? 0.2 : 1);
}
