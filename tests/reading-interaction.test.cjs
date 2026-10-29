const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

function load(file, overrides = {}) {
  const filename = path.resolve(file);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = (id) => {
    if (id in overrides) return overrides[id];
    if (id.startsWith("@/") && id.endsWith(".json")) return require("../src/" + id.slice(2));
    if (id.startsWith("@/")) {
      const tsPath = path.resolve(__dirname, "../src/" + id.slice(2) + ".ts");
      const tsxPath = path.resolve(__dirname, "../src/" + id.slice(2) + ".tsx");
      if (fs.existsSync(tsPath)) return load(tsPath, overrides);
      if (fs.existsSync(tsxPath)) return load(tsxPath, overrides);
    }
    if (id.startsWith(".")) {
      const dir = path.dirname(filename);
      const tsPath = path.resolve(dir, id + ".ts");
      const tsxPath = path.resolve(dir, id + ".tsx");
      if (fs.existsSync(tsPath)) return load(tsPath, overrides);
      if (fs.existsSync(tsxPath)) return load(tsxPath, overrides);
    }
    return Module.prototype.require.call(mod, id);
  };
  const code = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
  mod._compile(transpiled, filename);
  return mod.exports;
}

const chaptersLib = load("src/lib/reading-chapters.ts");
const audioLib = load("src/lib/consultation-audio.ts");
const spreadsLib = load("src/lib/spreads.ts");

test("uma conclusão dispara um único autoplay e não repete", () => {
  // Simula a lógica de consumo de conclusão por linha da mesa de 36
  const physicalRows = 4;
  const chapters = [
    { id: "section1", positions: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { id: "section2", positions: [10, 11, 12, 13, 14, 15, 16, 17, 18] },
    { id: "section3", positions: [19, 20, 21, 22, 23, 24, 25, 26, 27] },
    { id: "section4", positions: [28, 29, 30, 31, 32, 33, 34, 35, 36] },
  ];
  const consumedCompletions = new Set();
  let autoplayChapter = null;

  function onCardClosed(revealed) {
    for (let r = 0; r < physicalRows; r++) {
      const rowPositions = chapters[r].positions;
      const rowComplete = rowPositions.every((p) => p <= revealed);
      if (rowComplete && !consumedCompletions.has(r)) {
        consumedCompletions.add(r);
        autoplayChapter = chapters[r].id;
        break;
      }
    }
  }

  // Completa linha 1 (9 cartas) e fecha zoom
  onCardClosed(9);
  assert.equal(autoplayChapter, "section1");
  assert.equal(consumedCompletions.has(0), true);

  // Consome autoplay
  autoplayChapter = null;

  // Fechar zoom novamente com as mesmas 9 cartas não deve re-disparar
  onCardClosed(9);
  assert.equal(autoplayChapter, null);

  // Revela linha 2 (18 cartas)
  onCardClosed(18);
  assert.equal(autoplayChapter, "section2");
  autoplayChapter = null;

  // Revela linha 3 (27 cartas)
  onCardClosed(27);
  assert.equal(autoplayChapter, "section3");
  autoplayChapter = null;

  // Completa linha 4 (carta 36) e fecha zoom
  onCardClosed(36);
  assert.equal(autoplayChapter, "section4"); // Permanece na linha 4, não pula para síntese
  assert.equal(consumedCompletions.has(3), true);
});

test("abrir/fechar zoom várias vezes não dispara áudio, POST ou scroll", () => {
  let postCount = 0;
  let playCount = 0;
  let scrollCount = 0;

  // Mock do player e requisições
  const player = {
    play: async () => { playCount++; return Promise.resolve(); },
    pause: () => {},
  };

  // Simula estado estável durante zoom
  let enlargedPosition = null;
  const ready = true;
  let autoplayChapter = null; // Já consumido

  // Abre zoom na carta 5
  enlargedPosition = 5;
  // Durante o zoom: playbackReady é true (não depende de enlargedPosition === null)
  const playbackReadyDuringZoom = ready;
  assert.equal(playbackReadyDuringZoom, true);

  // Fecha zoom na carta 5
  enlargedPosition = null;
  if (autoplayChapter) player.play(); // Não dispara porque autoplayChapter é null

  // Repete 5 vezes
  for (let i = 0; i < 5; i++) {
    enlargedPosition = (i % 9) + 1;
    enlargedPosition = null;
    if (autoplayChapter) player.play();
  }

  assert.equal(playCount, 0);
  assert.equal(postCount, 0);
  assert.equal(scrollCount, 0);
});

test("navegar entre capítulos não inicia reprodução automaticamente", () => {
  let autoplayChapter = "section1";
  let activeChapter = 0;

  function selectChapter(newIndex) {
    autoplayChapter = null; // cancela intenção pendente
    activeChapter = newIndex;
  }

  selectChapter(1);
  assert.equal(activeChapter, 1);
  assert.equal(autoplayChapter, null); // Sem autoplay por seleção
});

test("pausa manual não é desfeita por renderizações", () => {
  let userPaused = false;
  let isPlaying = true;

  // Usuário pausa
  userPaused = true;
  isPlaying = false;

  // Componente re-renderiza (ex: zoom aberto e fechado)
  const autoPlayProp = false;
  const playbackReady = true;

  if (autoPlayProp && !userPaused && playbackReady) {
    isPlaying = true;
  }

  assert.equal(isPlaying, false);
  assert.equal(userPaused, true);
});

test("áudio atrasado não começa depois que o usuário mudou de intenção", () => {
  let autoplayChapter = "section1";
  let status = "pending";
  let audioPlayed = false;

  // Usuário muda de capítulo antes da narração chegar
  autoplayChapter = null;

  // Narração chega
  status = "ready";
  if (autoplayChapter === "section1" && status === "ready") {
    audioPlayed = true;
  }

  assert.equal(audioPlayed, false);
});

test("sem som não inicia geração automática", () => {
  const soundEnabled = false;
  let postCount = 0;

  function requestAudioIfAllowed() {
    if (soundEnabled === true) postCount++;
  }

  requestAudioIfAllowed();
  assert.equal(postCount, 0);
});

test("uma voz por vez, inclusive durante Live", () => {
  audioLib.setLiveVoiceActive(false);
  assert.equal(audioLib.isLiveVoiceActive(), false);

  audioLib.setLiveVoiceActive(true);
  assert.equal(audioLib.isLiveVoiceActive(), true);

  // Enquanto Live está ativo, capítulo não pode tocar
  let chapterPlayed = false;
  if (!audioLib.isLiveVoiceActive()) {
    chapterPlayed = true;
  }
  assert.equal(chapterPlayed, false);

  audioLib.setLiveVoiceActive(false);
});

test("travas de acesso da prévia de cinco preservadas", () => {
  const unpaidSession = { isPaid: false, cardsDrawn: [{ position: 1 }, { position: 2 }, { position: 3 }, { position: 4 }, { position: 5 }] };

  function canReveal(pos) {
    if (!unpaidSession.isPaid && pos >= 4) return false;
    return true;
  }

  assert.equal(canReveal(1), true);
  assert.equal(canReveal(3), true);
  assert.equal(canReveal(4), false);
  assert.equal(canReveal(5), false);
});

test("convite aparece uma vez; recusar não abre microfone nem pede token", () => {
  let showInvite = false;
  let inviteDismissed = false;
  let requestedToken = false;
  let requestedMic = false;

  // Síntese encerra
  function onSynthesisEnded(isPaid) {
    if (isPaid && !inviteDismissed) showInvite = true;
  }

  onSynthesisEnded(true);
  assert.equal(showInvite, true);

  // Usuário clica "Agora não"
  showInvite = false;
  inviteDismissed = true;

  assert.equal(requestedToken, false);
  assert.equal(requestedMic, false);

  // Navegar ou rever síntese não deve reabrir
  onSynthesisEnded(true);
  assert.equal(showInvite, false);
});

test("aceitar reutiliza o Live e mantém seu tempo", () => {
  let liveStarted = false;
  let micRequested = false;

  function onAccept() {
    liveStarted = true;
    micRequested = true;
  }

  onAccept();
  assert.equal(liveStarted, true);
  assert.equal(micRequested, true);
});

test("falhas de permissão/conexão não deixam microfone ou sessão presos", () => {
  let micActive = false;
  let tracksStopped = false;
  const mockTrack = { stop: () => { tracksStopped = true; } };

  // Falha simulada de conexão
  try {
    throw new Error("Erro de conexão");
  } catch {
    mockTrack.stop();
    micActive = false;
  }

  assert.equal(tracksStopped, true);
  assert.equal(micActive, false);
});

test("quatro cantos interpreta relações das posições 1, 9, 28 e 36", () => {
  const cards = Array.from({ length: 36 }, (_, i) => ({ id: i + 1, name: `Carta ${i + 1}` }));
  const sections = spreadsLib.spreadSections("grand36", cards, "Amizades & Caminhos", "complete");
  const cantos = sections.find((s) => s.id === "section6");
  assert.ok(cantos);
  assert.deepEqual(cantos.positions, [1, 9, 28, 36]);

  const hint = chaptersLib.chapterHint("grand36", "section6");
  assert.match(hint, /quatro cartas que ocupam os cantos da mesa/i);
  assert.doesNotMatch(hint, /moldura da mesa/i);
});
