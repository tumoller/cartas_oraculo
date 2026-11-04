const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function renderVoice(voice, resumable) {
  const filename = path.resolve('src/components/ConsultationImmersive.tsx');
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const audio = { getVoiceState: () => voice, canResumeCurrentVoice: () => resumable, isAudioPlaying: () => false, getChapterAudioState: () => ({ status: 'not_started' }), pauseCurrentVoice() {}, resumeCurrentVoice() {} };
  const overrides = {
    '@/lib/consultation-audio': audio,
    '@/lib/scene-assets': { sceneAssets: () => ({ close: '/avatar.png' }) },
    '@/lib/sound-preference': { useSoundPreference: () => true },
    '@/lib/reading-font': {},
    './SoundscapeControls': { SoundscapeControls: () => null },
    './ConsultationImmersive.module.css': {},
  };
  mod.require = id => id in overrides ? overrides[id] : Module.prototype.require.call(mod, id);
  const source = fs.readFileSync(filename, 'utf8');
  mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, filename);
  return renderToStaticMarkup(React.createElement(mod.exports.ConsultationImmersive, {
    session: { id: 'test', persona: 'Cigana', userName: 'Teste', spread: 'line3', cardsDrawn: [] },
    revealed: 0, chapter: 0, chapters: [], current: null, highlightedPositions: [], narrationReady: true,
    onRevealNext() {}, onSelectChapter() {}, onSelectCard() {}, onTogglePresentation() {}, onStartNarration() {},
  }));
}

test('narração pausada mantém foco e retomada; sem mídia oferece iniciar', () => {
  const paused = renderVoice({ active: false, kind: 'chapter', chapter: 'section1' }, true);
  assert.match(paused, /Narração pausada/);
  assert.match(paused, /Continuar leitura/);
  const ended = renderVoice({ active: false, kind: 'chapter', chapter: 'section1' }, false);
  assert.doesNotMatch(ended, /Narração pausada/);
  assert.match(ended, /Ouvir esta leitura/);
});
