const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../src/lib/consultation-audio.ts");
const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded.require = (name) => name === "@/lib/soundscape" ? { getVoiceVolume: () => 1 } : name === "react" ? { useSyncExternalStore() {} } : require(name);
loaded._compile(source, filename);
const audio = loaded.exports;

global.window = new EventTarget();
global.CustomEvent = class extends Event { constructor(name, options) { super(name); this.detail = options.detail; } };

class Player extends EventTarget {
  paused = true;
  ended = false;
  volume = 1;
  play() { this.paused = false; this.dispatchEvent(new Event("play")); return Promise.resolve(); }
  pause() { if (this.paused) return; this.paused = true; this.dispatchEvent(new Event("pause")); }
}

test("uma voz por vez e Live bloqueia novo áudio salvo", async () => {
  const first = new Player();
  const second = new Player();
  const stopFirst = audio.monitorMediaVoice(first, "welcome");
  const stopSecond = audio.monitorMediaVoice(second, "chapter", "card1");
  await first.play();
  assert.equal(first.paused, false);
  await second.play();
  assert.equal(first.paused, true);
  assert.equal(second.paused, false);
  audio.setLiveVoiceActive(true);
  assert.equal(second.paused, true);
  await first.play();
  assert.equal(first.paused, true);
  audio.setLiveVoiceActive(false);
  let resumableAtStop = true;
  const stopped = () => { resumableAtStop = audio.canResumeCurrentVoice(); };
  window.addEventListener("oracle-voice-state", stopped);
  stopFirst();
  stopSecond();
  assert.equal(resumableAtStop, false);
  window.removeEventListener("oracle-voice-state", stopped);
});

test("remontagem reutiliza MediaElementSource e som desligado impede continuar", async () => {
  let sources = 0;
  let closed = 0;
  global.requestAnimationFrame = () => 1;
  global.cancelAnimationFrame = () => {};
  global.AudioContext = class {
    state = "running";
    destination = {};
    createMediaElementSource() { sources++; return { connect() {}, disconnect() {} }; }
    createAnalyser() { return { fftSize: 0, connect() {}, disconnect() {}, getByteTimeDomainData() {} }; }
    close() { closed++; return Promise.resolve(); }
    suspend() { this.state = "suspended"; return Promise.resolve(); }
    resume() { this.state = "running"; return Promise.resolve(); }
  };
  const player = new Player();
  const cleanup = audio.monitorMediaVoice(player, "chapter", "card1");
  await player.play();
  cleanup();
  assert.equal(player.paused, true);
  const again = audio.monitorMediaVoice(player, "chapter", "card1");
  await player.play();
  assert.equal(sources, 1);
  assert.equal(closed, 0);
  player.pause();
  await audio.resumeCurrentVoice(false);
  assert.equal(player.paused, true);
  await audio.resumeCurrentVoice(true);
  assert.equal(player.paused, false);
  again();
});
