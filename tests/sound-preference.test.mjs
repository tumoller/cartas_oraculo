import assert from "node:assert/strict";
import { test } from "node:test";
import { setSoundPreference } from "../src/lib/sound-preference.ts";

test("a escolha de som persiste, avisa os players e funciona sem armazenamento", () => {
  const previousWindow = globalThis.window;
  const previousStorage = globalThis.localStorage;
  const events = [];
  const values = new Map();
  globalThis.window = { dispatchEvent: (event) => { events.push(event.type); return true; } };
  globalThis.localStorage = { setItem: (key, value) => values.set(key, value) };
  try {
    setSoundPreference(true);
    assert.equal(values.get("oracle_sound_preference"), "on");
    assert.deepEqual(events, ["oracle-sound-preference"]);
    events.length = 0;
    setSoundPreference(false);
    assert.equal(values.get("oracle_sound_preference"), "off");
    assert.deepEqual(events, ["oracle-sound-off", "oracle-sound-preference"]);
    globalThis.localStorage = { setItem: () => { throw new Error("blocked"); } };
    assert.doesNotThrow(() => setSoundPreference(false));
  } finally {
    globalThis.window = previousWindow;
    globalThis.localStorage = previousStorage;
  }
});
