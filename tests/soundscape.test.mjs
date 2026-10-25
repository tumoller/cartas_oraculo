import assert from "node:assert/strict";
import { test } from "node:test";
import { ambientPlaybackVolume, getVoiceVolume, setVoiceVolume, soundscapeAssets } from "../src/lib/soundscape.ts";

test("ambiente reduz com voz e fica mudo durante microfone ou som desligado", () => {
  assert.equal(ambientPlaybackVolume(0.25, false, false, true), 0.25);
  assert.equal(ambientPlaybackVolume(0.25, true, false, true), 0.05);
  assert.equal(ambientPlaybackVolume(0.25, true, true, true), 0);
  assert.equal(ambientPlaybackVolume(0.25, false, false, false), 0);
});

test("assets sem aprovação ficam inativos e volume funciona com armazenamento bloqueado", () => {
  assert.ok(Object.values(soundscapeAssets.effects).every((value) => value === null));
  assert.ok(Object.values(soundscapeAssets.ambience).every((value) => value === null));
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  globalThis.localStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  globalThis.window = { dispatchEvent: () => true };
  try {
    setVoiceVolume(0.3);
    assert.equal(getVoiceVolume(), 0.3);
    setVoiceVolume(2);
    assert.equal(getVoiceVolume(), 1);
  } finally {
    globalThis.localStorage = previousStorage;
    globalThis.window = previousWindow;
  }
});
