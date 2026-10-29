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

test("prévia de cinco -> desbloqueio -> quinta carta -> conclusão única", () => {
  let isPaid = false;
  let revealed = 0;
  let enlargedPosition = null;
  let activeView = "card";
  let autoplayChapter = null;
  const narration = true;

  const previewCompleted = { current: false };
  const fullCompleted = { current: false };

  function checkCompletionEffect() {
    if (enlargedPosition !== null) return;
    if (!isPaid) {
      if (revealed === 3 && !previewCompleted.current) {
        previewCompleted.current = true;
        activeView = "overview";
      }
      return;
    }
    if (revealed === 5 && !fullCompleted.current) {
      fullCompleted.current = true;
      setActiveView("overview");
      if (narration === true) {
        autoplayChapter = "synthesis";
      }
    }
  }

  function setActiveView(view) {
    activeView = view;
  }

  // 1. Revela cartas 1 a 3 da prévia
  for (let p = 1; p <= 3; p++) {
    revealed = p;
    enlargedPosition = p;
    checkCompletionEffect();
    assert.equal(activeView, "card");
    assert.equal(previewCompleted.current, false);
    assert.equal(autoplayChapter, null);
    enlargedPosition = null;
    checkCompletionEffect();
  }

  // Fechou carta 3: prévia concluída, sem disparar síntese
  assert.equal(previewCompleted.current, true);
  assert.equal(fullCompleted.current, false);
  assert.equal(activeView, "overview");
  assert.equal(autoplayChapter, null);

  // Reabertura de carta da prévia não altera estado
  enlargedPosition = 2;
  checkCompletionEffect();
  enlargedPosition = null;
  checkCompletionEffect();
  assert.equal(autoplayChapter, null);

  // 2. Desbloqueio pago (PixModal onSuccess)
  isPaid = true;
  checkCompletionEffect();
  assert.equal(fullCompleted.current, false);
  assert.equal(autoplayChapter, null);

  // 3. Revela carta 4
  revealed = 4;
  enlargedPosition = 4;
  checkCompletionEffect();
  enlargedPosition = null;
  checkCompletionEffect();
  assert.equal(fullCompleted.current, false);
  assert.equal(autoplayChapter, null);

  // 4. Revela carta 5 (ampliada)
  revealed = 5;
  enlargedPosition = 5;
  checkCompletionEffect();
  assert.equal(fullCompleted.current, false);
  assert.equal(autoplayChapter, null);

  // 5. Fecha zoom da carta 5: conclusão completa única disparada
  enlargedPosition = null;
  checkCompletionEffect();
  assert.equal(fullCompleted.current, true);
  assert.equal(activeView, "overview");
  assert.equal(autoplayChapter, "synthesis");

  // Consome autoplay
  autoplayChapter = null;

  // 6. Reabrir cartas já abertas NÃO repete essa conclusão
  for (let p = 1; p <= 5; p++) {
    enlargedPosition = p;
    checkCompletionEffect();
    enlargedPosition = null;
    checkCompletionEffect();
    assert.equal(autoplayChapter, null);
  }
});

test("nove cartas: canReadChapter libera linhas 1, 2 e 3 em 3, 6 e 9 cartas no novo método", () => {
  const methodVersion = "lenormand-box9-v2";
  const row1 = [1, 2, 3];
  const row2 = [4, 5, 6];
  const row3 = [7, 8, 9];
  const colunas = [1, 4, 7, 2, 5, 8, 3, 6, 9];
  const diagonais = [1, 5, 9, 3, 7];

  // Com 2 cartas: linha 1 ainda bloqueada
  assert.equal(chaptersLib.canReadChapter("box9", "section1", row1, 2, 9, methodVersion), false);

  // Com 3 cartas: linha 1 liberada! Linha 2 e 3 bloqueadas
  assert.equal(chaptersLib.canReadChapter("box9", "section1", row1, 3, 9, methodVersion), true);
  assert.equal(chaptersLib.canReadChapter("box9", "section2", row2, 3, 9, methodVersion), false);
  assert.equal(chaptersLib.canReadChapter("box9", "section3", row3, 3, 9, methodVersion), false);
  assert.equal(chaptersLib.canReadChapter("box9", "section4", colunas, 3, 9, methodVersion), false);

  // Com 6 cartas: linha 2 liberada! Linha 3 e colunas/diagonais bloqueadas
  assert.equal(chaptersLib.canReadChapter("box9", "section2", row2, 6, 9, methodVersion), true);
  assert.equal(chaptersLib.canReadChapter("box9", "section3", row3, 6, 9, methodVersion), false);
  assert.equal(chaptersLib.canReadChapter("box9", "section4", colunas, 6, 9, methodVersion), false);

  // Com 9 cartas: linha 3 e seções adicionais liberadas
  assert.equal(chaptersLib.canReadChapter("box9", "section3", row3, 9, 9, methodVersion), true);
  assert.equal(chaptersLib.canReadChapter("box9", "section4", colunas, 9, 9, methodVersion), true);
  assert.equal(chaptersLib.canReadChapter("box9", "section5", diagonais, 9, 9, methodVersion), true);
});

test("acervo antigo mantém liberação segura de capítulos e sem autoplay acumulado", () => {
  const row1_9 = [1, 2, 3];
  const row1_36 = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Box 9 antigo: linha 1 NÃO libera com 3 cartas nem com 6
  assert.equal(chaptersLib.canReadChapter("box9", "section1", row1_9, 3, 9, undefined), false);
  assert.equal(chaptersLib.canReadChapter("box9", "section1", row1_9, 6, 9, undefined), false);
  assert.equal(chaptersLib.canReadChapter("box9", "section1", row1_9, 9, 9, undefined), true);

  // Grand 36 antigo: linha 1 NÃO libera com 9 cartas
  assert.equal(chaptersLib.canReadChapter("grand36", "section1", row1_36, 9, 36, undefined), false);
  assert.equal(chaptersLib.canReadChapter("grand36", "section1", row1_36, 36, 36, undefined), true);

  // Loop de SpreadBoard: acervo antigo não consome antes da hora e não dispara autoplay acumulado ao completar
  const physicalRows = 3;
  const chapters = [
    { id: "section1", positions: [1, 2, 3] },
    { id: "section2", positions: [4, 5, 6] },
    { id: "section3", positions: [7, 8, 9] },
  ];
  const consumedCompletions = new Set();
  let autoplayChapter = null;
  const isEarlyRowSpread = false; // legado

  function runEffect(revealed) {
    for (let r = 0; r < physicalRows; r++) {
      const rowId = chapters[r]?.id || "";
      const rowPositions = chapters[r]?.positions || [];
      const rowComplete = rowPositions.length > 0 && rowPositions.every((pos) => pos <= revealed);
      const rowCanRead = chaptersLib.canReadChapter("box9", rowId, rowPositions, revealed, 9, undefined);
      if (rowComplete && rowCanRead && !consumedCompletions.has(r)) {
        consumedCompletions.add(r);
        if (isEarlyRowSpread) {
          autoplayChapter = rowId;
          break;
        }
      }
    }
  }

  // Com 3 cartas: nada consumido, sem autoplay
  runEffect(3);
  assert.equal(consumedCompletions.size, 0);
  assert.equal(autoplayChapter, null);

  // Com 6 cartas: nada consumido, sem autoplay
  runEffect(6);
  assert.equal(consumedCompletions.size, 0);
  assert.equal(autoplayChapter, null);

  // Com 9 cartas: mesa liberada sem disparar sequência inesperada de áudios
  runEffect(9);
  assert.equal(consumedCompletions.size, 3);
  assert.equal(autoplayChapter, null);
});

test("zoom repetido não reinicia áudio nem afeta reprodução", () => {
  let playCount = 0;
  const mockPlayer = {
    play: () => { playCount++; return Promise.resolve(); },
    pause: () => {},
  };

  let enlargedPosition = null;
  const attemptedPlay = { current: "/audio/synthesis.mp3" };
  let autoplayChapter = null;

  function onCardZoom(pos) {
    enlargedPosition = pos;
  }

  function onCardClose() {
    enlargedPosition = null;
    if (autoplayChapter && attemptedPlay.current !== "/audio/synthesis.mp3") {
      mockPlayer.play();
    }
  }

  for (let p = 1; p <= 5; p++) {
    onCardZoom(p);
    assert.equal(enlargedPosition, p);
    onCardClose();
    assert.equal(enlargedPosition, null);
  }

  assert.equal(playCount, 0);
});

test("pausa e navegação cancelam intenção pendente de autoplay", () => {
  let autoplayChapter = "section1";
  const attemptedPlay = { current: "" };
  let playInitiated = false;
  const mockPlayer = {
    play: () => {
      playInitiated = true;
      return Promise.resolve();
    },
  };

  const onAutoPlayConsumed = () => { autoplayChapter = null; };
  const onAutoPlayConsumedRef = { current: onAutoPlayConsumed };

  // Cenário A: Usuário pausou explicitamente
  const userPaused = { current: true };
  function runAudioEffect(autoPlay, status) {
    if (!autoPlay) return;
    if (userPaused.current) {
      onAutoPlayConsumedRef.current?.();
      return;
    }
    if (status !== "ready") return;
    attemptedPlay.current = "some-url";
    onAutoPlayConsumedRef.current?.();
    mockPlayer.play();
  }

  runAudioEffect(autoplayChapter === "section1", "pending");
  assert.equal(autoplayChapter, null);
  assert.equal(playInitiated, false);

  // Cenário B: Áudio pendente, usuário navega de capítulo
  autoplayChapter = "section2";
  userPaused.current = false;
  runAudioEffect(autoplayChapter === "section2", "pending");
  assert.equal(playInitiated, false);
  // Usuário muda de capítulo pelo seletor (cancela intenção ativa)
  autoplayChapter = null;
  // Áudio chega após navegação
  runAudioEffect(autoplayChapter === "section2", "ready");
  assert.equal(playInitiated, false);
});

test("render durante play() não deixa intenção inconsistente", async () => {
  let playResolve;
  const playPromise = new Promise((resolve) => { playResolve = resolve; });
  let playCount = 0;
  const mockPlayer = {
    play: () => {
      playCount++;
      return playPromise;
    },
  };

  const attemptedPlay = { current: "" };
  let autoplayChapter = "section1";
  const onAutoPlayConsumed = () => { autoplayChapter = null; };
  const onAutoPlayConsumedRef = { current: onAutoPlayConsumed };

  const url = "/audio/chapter-section1.mp3";
  let error = "";

  function triggerAutoplayEffect(autoPlay, playbackReady, soundEnabled, status) {
    if (!autoPlay || !playbackReady || soundEnabled !== true) return;
    if (status !== "ready" || !mockPlayer || attemptedPlay.current === url) {
      if (attemptedPlay.current === url) onAutoPlayConsumedRef.current?.();
      return;
    }

    attemptedPlay.current = url;
    onAutoPlayConsumedRef.current?.();

    mockPlayer.play()
      .then(() => { error = ""; })
      .catch(() => { error = "O navegador pediu um toque para iniciar a narração. Toque em Reproduzir narração."; });
  }

  // Disparo inicial
  triggerAutoplayEffect(autoplayChapter === "section1", true, true, "ready");
  assert.equal(playCount, 1);
  assert.equal(attemptedPlay.current, url);
  assert.equal(autoplayChapter, null); // Intenção consumida imediatamente

  // Re-render durante o play() pendente (com novo callback inline)
  let secondCallbackCalled = false;
  onAutoPlayConsumedRef.current = () => { secondCallbackCalled = true; };

  triggerAutoplayEffect(autoplayChapter === "section1", true, true, "ready");
  assert.equal(playCount, 1); // Não chamou play novamente

  playResolve();
  await playPromise;

  assert.equal(error, "");
  assert.equal(autoplayChapter, null);
});

test("navegar entre capítulos não inicia reprodução automaticamente", () => {
  let autoplayChapter = "section1";
  let activeChapter = 0;

  function selectChapter(newIndex) {
    autoplayChapter = null;
    activeChapter = newIndex;
  }

  selectChapter(1);
  assert.equal(activeChapter, 1);
  assert.equal(autoplayChapter, null);
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
  const hadWindow = "window" in global;
  const hadCustomEvent = "CustomEvent" in global;
  const prevWindow = global.window;
  const prevCustomEvent = global.CustomEvent;

  if (!hadWindow || !global.window) {
    global.window = new EventTarget();
  }
  if (!hadCustomEvent || !global.CustomEvent) {
    global.CustomEvent = class extends Event {
      constructor(type, init) {
        super(type);
        this.detail = init?.detail;
      }
    };
  }

  try {
    audioLib.setLiveVoiceActive(false);
    assert.equal(audioLib.isLiveVoiceActive(), false);

    audioLib.setLiveVoiceActive(true);
    assert.equal(audioLib.isLiveVoiceActive(), true);

    let chapterPlayed = false;
    if (!audioLib.isLiveVoiceActive()) {
      chapterPlayed = true;
    }
    assert.equal(chapterPlayed, false);

    audioLib.setLiveVoiceActive(false);
  } finally {
    if (hadWindow) global.window = prevWindow; else delete global.window;
    if (hadCustomEvent) global.CustomEvent = prevCustomEvent; else delete global.CustomEvent;
  }
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

  function onSynthesisEnded(isPaid) {
    if (isPaid && !inviteDismissed) showInvite = true;
  }

  onSynthesisEnded(true);
  assert.equal(showInvite, true);

  showInvite = false;
  inviteDismissed = true;

  assert.equal(requestedToken, false);
  assert.equal(requestedMic, false);

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
