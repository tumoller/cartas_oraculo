"use client";

import { useSyncExternalStore } from "react";

const key = "oracle_sound_preference";
const changeEvent = "oracle-sound-preference";
let fallback: boolean | null = null;

function readPreference(): boolean | null {
  try {
    const saved = localStorage.getItem(key);
    return saved === "on" ? true : saved === "off" ? false : fallback;
  } catch {
    return fallback;
  }
}

function subscribe(notify: () => void) {
  const changed = () => notify();
  const changedInAnotherTab = (event: StorageEvent) => {
    if (event.key !== key) return;
    if (event.newValue === "off") window.dispatchEvent(new Event("oracle-sound-off"));
    notify();
  };
  window.addEventListener(changeEvent, changed);
  window.addEventListener("storage", changedInAnotherTab);
  return () => {
    window.removeEventListener(changeEvent, changed);
    window.removeEventListener("storage", changedInAnotherTab);
  };
}

export function useSoundPreference(): boolean | null {
  return useSyncExternalStore(subscribe, readPreference, () => null);
}

export function setSoundPreference(enabled: boolean): void {
  fallback = enabled;
  try { localStorage.setItem(key, enabled ? "on" : "off"); } catch { /* Private browsing can block storage. */ }
  if (!enabled) window.dispatchEvent(new Event("oracle-sound-off"));
  window.dispatchEvent(new Event(changeEvent));
}
