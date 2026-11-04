const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/components/LiveConsultation.tsx');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));

async function exercise(initialMic) {
  let index = 0, slots = [], effects = [], tree, ws;
  const react = {
    useRef(value) { const i = index++; return slots[i] ??= { current: value }; },
    useState(value) { const i = index++; if (!(i in slots)) slots[i] = value; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; },
    useEffect(fn, deps) { const i = index++; const old = slots[i]; if (!old || deps.some((v, n) => v !== old.deps[n])) { effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); } },
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = name => ({
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/image': { __esModule: true, default: 'img' },
    '@/lib/live-playback': { pcmStartTime: () => 0 },
    '@/lib/sound-preference': { useSoundPreference: () => true, setSoundPreference() {} },
    '@/lib/scene-assets': { sceneAssets: () => ({ close: '', accent: '#000' }) },
    '@/lib/consultation-audio': { monitorLiveVoice: () => () => {}, setLiveVoiceActive() {} },
    '@/lib/soundscape': { getVoiceVolume: () => 1 },
  })[name] ?? require(name);
  loaded._compile(compiled, filename);
  global.window = new EventTarget();
  window.isSecureContext = true;
  global.CustomEvent = class extends Event { constructor(type, options) { super(type); this.detail = options?.detail; } };
  const track = { enabled: true, stopped: false, stop() { this.stopped = true; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  Object.defineProperty(global, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => stream } } });
  const contexts = [];
  class Context {
    constructor() { this.destination = {}; this.closed = false; contexts.push(this); }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
    createAnalyser() { return { connect() {}, disconnect() {} }; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createScriptProcessor() { return this.processor = { connect() {}, disconnect() {} }; }
    resume() { return Promise.resolve(); }
    close() { this.closed = true; return Promise.resolve(); }
  }
  global.AudioContext = Context;
  global.WebSocket = class {
    static OPEN = 1;
    constructor() { this.readyState = 1; this.sent = []; ws = this; }
    send(value) { this.sent.push(JSON.parse(value)); }
    close() { this.readyState = 3; }
  };
  global.fetch = async (_url, options) => ({ ok: true, json: async () => options?.method === 'POST' ? { token: 'x', model: 'x', expiresAt: new Date(Date.now() + 180000).toISOString() } : { enabled: true } });
  const render = () => { index = 0; tree = loaded.exports.LiveConsultation({ session: { id: 'test', isPaid: true, persona: 'x' }, immersive: true }); const pending = effects; effects = []; pending.forEach(fn => fn()); };
  const button = text => {
    const find = node => {
      if (!node || typeof node !== 'object') return null;
      if (node.type === 'button' && node.props.children === text) return node;
      return [node.props?.children].flat(Infinity).map(find).find(Boolean);
    };
    const found = find(tree); assert.ok(found, `button ${text}`); return found;
  };
  render(); await flush(); render();
  if (initialMic) window.dispatchEvent(new CustomEvent('oracle-start-live-conversation', { detail: { sessionId: 'test', requestMic: true } }));
  else button('Começar conversa com som').props.onClick();
  await flush(); ws.onopen(); ws.onmessage({ data: JSON.stringify({ setupComplete: {} }) }); await flush(); render();
  if (!initialMic) { await button('Ligar microfone').props.onClick(); render(); }
  const processor = contexts[1].processor;
  const pcm = () => processor.onaudioprocess({ inputBuffer: { sampleRate: 16000, getChannelData: () => new Float32Array([0.5, -0.5]) } });
  const audioCount = () => ws.sent.filter(x => x.realtimeInput?.audio).length;
  pcm(); assert.equal(audioCount(), 1);
  await button('Desligar microfone').props.onClick(); render();
  assert.equal(track.enabled, false); pcm(); assert.equal(audioCount(), 1);
  assert.equal(contexts[0].closed, false); assert.equal(contexts[1].closed, false); assert.equal(track.stopped, false);
  await button('Ligar microfone').props.onClick(); render();
  assert.equal(track.enabled, true); pcm(); assert.equal(audioCount(), 2);
  button('Encerrar').props.onClick();
  assert.equal(track.stopped, true); assert.equal(contexts[1].closed, true); assert.equal(contexts[0].closed, true);
  slots.forEach(x => x?.cleanup?.());
}

test('silenciar e retomar captura inicial e posterior, encerrando recursos', async () => {
  await exercise(true);
  await exercise(false);
});
