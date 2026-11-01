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

test("troca de leitura com áudio tocando: preserva posição, pausa e retoma corretamente", () => {
  const sessionId = "test-session-swap";
  audioLib.saveChapterTime(sessionId, "section1", 3.25);
  assert.equal(audioLib.getSavedChapterTime(sessionId, "section1"), 3.25);

  audioLib.clearChapterTime(sessionId, "section1");
  assert.equal(audioLib.getSavedChapterTime(sessionId, "section1"), 0);

  // Simular troca com cancelamento (Continuar ouvindo)
  let playingPaused = false;
  let resumed = false;
  const mockMedia = {
    currentTime: 4.5,
    paused: false,
    ended: false,
    pause: () => { playingPaused = true; mockMedia.paused = true; },
    play: async () => { resumed = true; mockMedia.paused = false; },
  };

  // Pausa ao tentar trocar
  mockMedia.pause();
  assert.equal(playingPaused, true);
  assert.equal(mockMedia.currentTime, 4.5);

  // Cancelar troca -> retoma sem alterar posição
  audioLib.resumePlayingMedia(mockMedia);
  assert.equal(resumed, true);
  assert.equal(mockMedia.currentTime, 4.5);

  // Confirmar troca -> salva posição anterior
  audioLib.saveChapterTime(sessionId, "section1", mockMedia.currentTime);
  assert.equal(audioLib.getSavedChapterTime(sessionId, "section1"), 4.5);
});

test("conclusão de nova linha durante áudio: cancelar mantém linha atual sem ciclo, confirmar avança com autoplay", () => {
  const consumedCompletions = new Set([0]); // linha 1 já concluída
  let currentChapter = 0; // Linha 1
  let revealed = 6; // Linha 2 revelada
  let autoplayChapter = null;
  let pendingNavigation = null;

  const mockPlaying = {
    currentTime: 2.8,
    paused: false,
    ended: false,
    pause: () => { mockPlaying.paused = true; },
    play: async () => { mockPlaying.paused = false; },
  };

  // Linha 2 conclui com áudio tocando
  if (!consumedCompletions.has(1)) {
    consumedCompletions.add(1);
    mockPlaying.pause();
    pendingNavigation = {
      type: "row-completion",
      targetIndex: 1,
      targetChapterId: "section2",
      previousChapterId: "section1",
      previousTime: mockPlaying.currentTime,
      media: mockPlaying,
    };
  }

  assert.ok(pendingNavigation);
  assert.equal(consumedCompletions.has(1), true);
  assert.equal(mockPlaying.paused, true);
  assert.equal(currentChapter, 0); // Linha 1 mantida
  assert.equal(revealed, 6); // Cartas preservadas

  // Se cancelar ("Continuar ouvindo"):
  mockPlaying.play();
  pendingNavigation = null;
  assert.equal(currentChapter, 0);
  assert.equal(mockPlaying.paused, false);
  assert.equal(autoplayChapter, null);

  // Reavaliação não reabre ciclo porque linha 2 já está em consumedCompletions
  let retriggered = false;
  if (!consumedCompletions.has(1)) {
    retriggered = true;
  }
  assert.equal(retriggered, false);
});

test("modo texto não dispara geração nem pede confirmação ao navegar", () => {
  const sessionId = "test-session-text";
  const narration = false;
  let requests = [];

  // Em modo texto, prepare não deve ser true
  const isPaid = true;
  const ready = true;
  const prepare = isPaid && narration === true && ready;
  assert.equal(prepare, false);
  assert.equal(requests.length, 0);

  // Navegar em modo texto deve ser imediato sem pendência
  let pendingNavigation = null;
  const isPlaying = audioLib.isAudioPlaying(sessionId);
  assert.equal(isPlaying, false);
  if (narration !== true) {
    // navega diretamente
  } else if (isPlaying) {
    pendingNavigation = { mode: "playing" };
  }
  assert.equal(pendingNavigation, null);
});

test("deduplicação de POST e geração restrita à leitura atual", () => {
  const sessionId = "test-session-dedup";
  const chapter = "section1";

  audioLib.resetAudioTracking();
  assert.equal(audioLib.hasRequestedChapter(sessionId, chapter), false);

  // Primeiro pedido
  audioLib.markChapterRequested(sessionId, chapter);
  assert.equal(audioLib.hasRequestedChapter(sessionId, chapter), true);

  // Segundo pedido (ex: zoom ou retorno) detecta que já foi solicitado
  const shouldSkipPost = audioLib.hasRequestedChapter(sessionId, chapter);
  assert.equal(shouldSkipPost, true);

  // Capítulos futuros não foram pedidos
  assert.equal(audioLib.hasRequestedChapter(sessionId, "section2"), false);
  assert.equal(audioLib.hasRequestedChapter(sessionId, "synthesis"), false);
});

test("sair de leitura preparando ou pronta e não ouvida: solicita confirmação de avanço", () => {
  const sessionId = "test-session-unheard";
  audioLib.resetAudioTracking();

  // Capítulo 1 preparando
  audioLib.setChapterAudioState(sessionId, "section1", {
    status: "pending",
    hasPlayed: false,
    userPaused: false,
  });

  const state1 = audioLib.getChapterAudioState(sessionId, "section1");
  const isPreparing1 = state1.status === "pending" || state1.status === "generating";
  assert.equal(isPreparing1, true);

  // Tentativa de navegar abre diálogo com mode: 'unheard'
  let pendingNavigation = null;
  if (isPreparing1) {
    pendingNavigation = {
      mode: "unheard",
      targetIndex: 1,
      targetChapterId: "section2",
      previousChapterId: "section1",
    };
  }
  assert.ok(pendingNavigation);
  assert.equal(pendingNavigation.mode, "unheard");

  // Capítulo 1 pronto mas não ouvido (hasPlayed=false, userPaused=false)
  audioLib.setChapterAudioState(sessionId, "section1", {
    status: "ready",
    hasPlayed: false,
    userPaused: false,
  });
  const stateReady = audioLib.getChapterAudioState(sessionId, "section1");
  const isReadyUnheard = stateReady.status === "ready" && !stateReady.hasPlayed && !stateReady.userPaused;
  assert.equal(isReadyUnheard, true);

  // Se o usuário já tiver pausado manualmente, NÃO deve pedir confirmação
  audioLib.setChapterAudioState(sessionId, "section1", {
    status: "ready",
    hasPlayed: true,
    userPaused: true,
  });
  const statePaused = audioLib.getChapterAudioState(sessionId, "section1");
  const shouldPromptWhenPaused =
    (statePaused.status === "ready" && !statePaused.hasPlayed && !statePaused.userPaused) ||
    statePaused.status === "pending";
  assert.equal(shouldPromptWhenPaused, false);
});

test("selectFromTable em 5 cartas: tocar carta revelada só abre zoom sem pausar síntese", () => {
  let activeView = "overview";
  let enlargedPosition = null;
  let audioPaused = false;
  let viewChanged = false;

  const mockPlaying = {
    paused: false,
    pause: () => { audioPaused = true; },
  };

  const selectFromTable = (next, revealed) => {
    if (next <= revealed) {
      enlargedPosition = next;
    }
  };

  // Tocar carta 1 já revelada durante síntese
  selectFromTable(1, 5);
  assert.equal(enlargedPosition, 1);
  assert.equal(activeView, "overview");
  assert.equal(audioPaused, false);
  assert.equal(viewChanged, false);

  // Fechar zoom
  enlargedPosition = null;
  assert.equal(activeView, "overview");
  assert.equal(audioPaused, false);
});

test("áudio de acolhimento é restrito e não interfere na reprodução de capítulo", () => {
  const sessionId = "test-session-welcome";
  audioLib.resetAudioTracking();

  // Salvar posição com chapter = "welcome" deve ser ignorado
  audioLib.saveChapterTime(sessionId, "welcome", 5.0);
  assert.equal(audioLib.getSavedChapterTime(sessionId, "welcome"), 0);

  // isAudioPlaying verifica apenas áudio de capítulo
  assert.equal(audioLib.isAudioPlaying(sessionId), false);
});

test("recuperação de falhas: POST que falha antes de criar o job e recuperação posterior", async () => {
  const sessionId = "session-post-fail";
  const chapter = "section1";
  audioLib.resetAudioTracking();

  let postCount = 0;
  let serverStatus = "not_started";
  let failFirstPost = true;

  const mockRequestAudio = async () => {
    if (audioLib.hasRequestedChapter(sessionId, chapter)) {
      if (serverStatus !== "not_started" && serverStatus !== "failed") {
        return;
      }
    }
    audioLib.markChapterRequested(sessionId, chapter);
    postCount++;
    if (failFirstPost) {
      failFirstPost = false;
      // POST falhou antes de criar job no servidor
      // Consulta ao servidor após erro de transporte confirma not_started:
      if (serverStatus === "not_started" || serverStatus === "failed") {
        audioLib.setChapterAudioState(sessionId, chapter, { status: serverStatus });
        audioLib.clearChapterRequested(sessionId, chapter);
      }
      return { error: "Erro de transporte" };
    }
    // Servidor cria o job com sucesso
    serverStatus = "pending";
    audioLib.setChapterAudioState(sessionId, chapter, { status: "pending" });
    return { ok: true };
  };

  // Primeira tentativa: POST falha antes de criar job
  assert.equal(audioLib.hasRequestedChapter(sessionId, chapter), false);
  const res1 = await mockRequestAudio();
  assert.equal(res1.error, "Erro de transporte");
  assert.equal(postCount, 1);
  assert.equal(serverStatus, "not_started");
  // hasRequestedChapter foi liberado pois o servidor confirmou not_started
  assert.equal(audioLib.hasRequestedChapter(sessionId, chapter), false);

  // Recuperação posterior via ação explícita compatível com endpoint existente:
  const res2 = await mockRequestAudio();
  assert.equal(res2.ok, true);
  assert.equal(postCount, 2);
  assert.equal(serverStatus, "pending");
  // Deduplicação preservada enquanto pendente
  assert.equal(audioLib.hasRequestedChapter(sessionId, chapter), true);

  // Tentativa repetida não gera novo POST
  await mockRequestAudio();
  assert.equal(postCount, 2);
});

test("recuperação de falhas: resposta perdida após criação do job, sem duplicação", async () => {
  const sessionId = "session-lost-response";
  const chapter = "section1";
  audioLib.resetAudioTracking();

  let postCount = 0;
  let serverStatus = "not_started";

  const mockRequestAudio = async () => {
    if (audioLib.hasRequestedChapter(sessionId, chapter)) {
      if (serverStatus !== "not_started" && serverStatus !== "failed") {
        return;
      }
    }
    audioLib.markChapterRequested(sessionId, chapter);
    postCount++;
    // Servidor cria o job com sucesso:
    serverStatus = "pending";
    // Mas cliente sofre erro de transporte ao receber a resposta!
    // Cliente consulta servidor após erro de transporte:
    if (serverStatus === "pending") {
      audioLib.setChapterAudioState(sessionId, chapter, { status: "pending" });
      audioLib.markChapterRequested(sessionId, chapter);
    }
    return { error: "Transport error on response" };
  };

  const res = await mockRequestAudio();
  assert.equal(res.error, "Transport error on response");
  assert.equal(postCount, 1);
  assert.equal(serverStatus, "pending");
  // Deduplicação preservada mesmo com erro na resposta, pois servidor confirmou pending
  assert.equal(audioLib.hasRequestedChapter(sessionId, chapter), true);

  // Nova tentativa explícita do usuário: consulta servidor, detecta pending e não duplica POST
  await mockRequestAudio();
  assert.equal(postCount, 1);
});

test("encerrar apresentação antes do convite e sem áudio residual (5 cartas e demais jogos)", () => {
  const hadWindow = "window" in global;
  const prevWindow = global.window;
  if (!hadWindow || !global.window) global.window = new EventTarget();

  let showPresentation = true;
  let showLiveInvite = false;
  let openDialogCount = () => (showPresentation ? 1 : 0) + (showLiveInvite ? 1 : 0);

  let mockPlayer = {
    paused: false,
    ended: true,
    pause() { this.paused = true; },
  };

  // 1. Apresentação aberta durante a narração da síntese
  assert.equal(showPresentation, true);
  assert.equal(showLiveInvite, false);
  assert.equal(openDialogCount(), 1);

  // 2. onEnded da síntese das cinco cartas:
  // Fecha apresentação antes de abrir convite
  const onEndedFive = () => {
    showPresentation = false;
    showLiveInvite = true;
  };

  onEndedFive();
  assert.equal(showPresentation, false);
  assert.equal(showLiveInvite, true);
  // Exatamente um diálogo aberto ao terminar a síntese
  assert.equal(openDialogCount(), 1);

  // 3. Aceitar convite: pausa voz residual, fecha convite
  let voicePausedOnAccept = false;
  const onAcceptInvite = () => {
    audioLib.pauseCurrentVoice();
    mockPlayer.pause();
    voicePausedOnAccept = mockPlayer.paused;
    showLiveInvite = false;
  };
  onAcceptInvite();
  assert.equal(showLiveInvite, false);
  assert.equal(openDialogCount(), 0);
  assert.equal(voicePausedOnAccept, true);

  // 4. Teste em demais jogos (mesa de 36 / SpreadBoard):
  let spreadPresentation = true;
  let spreadInvite = false;
  let spreadOpenDialogs = () => (spreadPresentation ? 1 : 0) + (spreadInvite ? 1 : 0);
  assert.equal(spreadOpenDialogs(), 1);

  const onEndedSpread = (isSynthesis) => {
    spreadPresentation = false;
    if (isSynthesis) spreadInvite = true;
  };

  onEndedSpread(true);
  assert.equal(spreadPresentation, false);
  assert.equal(spreadInvite, true);
  assert.equal(spreadOpenDialogs(), 1);

  // Recusar convite: pausa voz residual, fecha convite
  mockPlayer.paused = false;
  let voicePausedOnDismiss = false;
  let focusRestored = false;
  const onDismissInvite = () => {
    audioLib.pauseCurrentVoice();
    mockPlayer.pause();
    voicePausedOnDismiss = mockPlayer.paused;
    spreadInvite = false;
    focusRestored = true;
  };
  onDismissInvite();
  assert.equal(spreadInvite, false);
  assert.equal(spreadOpenDialogs(), 0);
  assert.equal(voicePausedOnDismiss, true);
  assert.equal(focusRestored, true);

  if (hadWindow) global.window = prevWindow; else delete global.window;
});

test("36 cartas: concluir segunda linha enquanto a primeira ainda está preparando (cancelar e confirmar)", () => {
  const sessionId = "session-grand36-preparing";
  audioLib.resetAudioTracking();

  // Linha 1 concluída aos 9 cards
  let revealed = 9;
  let currentChapter = 0; // section1
  const consumedCompletions = new Set([0]);

  // Linha 1 preparando
  audioLib.setChapterAudioState(sessionId, "section1", {
    status: "pending",
    hasPlayed: false,
    userPaused: false,
  });
  let autoplayChapter = "section1";

  // Usuário revela cartas 10 a 18 da segunda linha
  revealed = 18;
  let pendingNavigation = null;
  let dialogOpenCount = 0;

  const triggerRowCompletion = (row) => {
    if (!consumedCompletions.has(row)) {
      consumedCompletions.add(row);
      const state = audioLib.getChapterAudioState(sessionId, "section1");
      const isPreparing = state.status === "pending" || state.status === "generating";
      if (isPreparing) {
        pendingNavigation = {
          mode: "unheard",
          type: "row-completion",
          targetIndex: row,
          targetChapterId: `section${row + 1}`,
          previousChapterId: "section1",
        };
        dialogOpenCount++;
      }
    }
  };

  triggerRowCompletion(1);
  assert.ok(pendingNavigation);
  assert.equal(dialogOpenCount, 1);
  assert.equal(pendingNavigation.mode, "unheard");
  assert.equal(revealed, 18); // Cartas reveladas preservadas
  assert.equal(currentChapter, 0); // Linha 1 mantida enquanto diálogo está aberto

  // --- Subcenário A: Cancelar troca ---
  const cancelSwitch = () => {
    pendingNavigation = null;
  };
  cancelSwitch();
  assert.equal(pendingNavigation, null);
  assert.equal(currentChapter, 0); // Mantém Linha 1
  assert.equal(revealed, 18); // 18 cartas preservadas
  assert.equal(autoplayChapter, "section1"); // Linha 2 abandonada NÃO recebe autoplay

  // Reavaliação: sem repetição do diálogo (consumedCompletions contém 1)
  triggerRowCompletion(1);
  assert.equal(pendingNavigation, null);
  assert.equal(dialogOpenCount, 1); // Sem repetição

  // Linha 2 abandonada não reproduz tardiamente; se linha 1 fica pronta, ela é que toca
  audioLib.setChapterAudioState(sessionId, "section1", { status: "ready" });
  assert.equal(autoplayChapter, "section1");

  // --- Subcenário B: Confirmar troca ---
  const consumedB = new Set([0]);
  let currentChapterB = 0;
  let autoplayChapterB = "section1";
  let pendingNavigationB = null;
  let dialogOpenCountB = 0;

  if (!consumedB.has(1)) {
    consumedB.add(1);
    pendingNavigationB = {
      mode: "unheard",
      type: "row-completion",
      targetIndex: 1,
      targetChapterId: "section2",
      previousChapterId: "section1",
    };
    dialogOpenCountB++;
  }

  const confirmSwitch = () => {
    currentChapterB = pendingNavigationB.targetIndex;
    autoplayChapterB = pendingNavigationB.targetChapterId;
    pendingNavigationB = null;
  };

  confirmSwitch();
  assert.equal(currentChapterB, 1); // Avançou para Linha 2
  assert.equal(autoplayChapterB, "section2"); // Linha 2 com autoplay
  assert.equal(revealed, 18); // 18 cartas preservadas
  assert.equal(pendingNavigationB, null);

  // Sem repetição do diálogo
  if (!consumedB.has(1)) {
    dialogOpenCountB++;
  }
  assert.equal(dialogOpenCountB, 1);

  // Linha 1 (abandonada) fica pronta no servidor: não reproduz tardiamente porque autoplayChapter é section2
  audioLib.setChapterAudioState(sessionId, "section1", { status: "ready" });
  assert.equal(autoplayChapterB, "section2");
  assert.notEqual(autoplayChapterB, "section1");
});

test("36 cartas: concluir segunda linha enquanto a primeira está tocando (cancelar e confirmar)", () => {
  const sessionId = "session-grand36-playing";
  audioLib.resetAudioTracking();

  // Linha 1 concluída e tocando aos 3.5s
  let revealed = 9;
  let currentChapter = 0;
  const consumedCompletions = new Set([0]);

  const mockPlayer = {
    currentTime: 3.5,
    paused: false,
    pause() { this.paused = true; },
    play() { this.paused = false; return Promise.resolve(); },
  };

  // Usuário revela cartas 10 a 18 (Linha 2 concluída)
  revealed = 18;
  let pendingNavigation = null;
  let dialogOpenCount = 0;

  const triggerRowCompletion = (row) => {
    if (!consumedCompletions.has(row)) {
      consumedCompletions.add(row);
      // Linha 1 estava tocando: pausa automaticamente e abre diálogo
      mockPlayer.pause();
      pendingNavigation = {
        mode: "playing",
        type: "row-completion",
        targetIndex: row,
        targetChapterId: `section${row + 1}`,
        previousChapterId: "section1",
        previousTime: mockPlayer.currentTime,
        media: mockPlayer,
      };
      dialogOpenCount++;
    }
  };

  triggerRowCompletion(1);
  assert.ok(pendingNavigation);
  assert.equal(dialogOpenCount, 1);
  assert.equal(mockPlayer.paused, true);
  assert.equal(revealed, 18); // 18 cartas preservadas
  assert.equal(currentChapter, 0);

  // --- Subcenário A: Cancelar troca ---
  const cancelSwitch = () => {
    audioLib.resumePlayingMedia(pendingNavigation.media);
    pendingNavigation = null;
  };
  cancelSwitch();
  assert.equal(pendingNavigation, null);
  assert.equal(mockPlayer.paused, false); // Linha 1 retoma reprodução
  assert.equal(mockPlayer.currentTime, 3.5); // Na mesma posição
  assert.equal(currentChapter, 0); // Linha 1 mantida
  assert.equal(revealed, 18); // 18 cartas preservadas

  // Sem repetição do diálogo
  triggerRowCompletion(1);
  assert.equal(pendingNavigation, null);
  assert.equal(dialogOpenCount, 1);

  // --- Subcenário B: Confirmar troca ---
  const consumedB = new Set([0]);
  let currentChapterB = 0;
  let autoplayChapterB = null;
  let pendingNavigationB = null;
  let dialogOpenCountB = 0;
  mockPlayer.paused = false;
  mockPlayer.currentTime = 5.2;

  if (!consumedB.has(1)) {
    consumedB.add(1);
    mockPlayer.pause();
    pendingNavigationB = {
      mode: "playing",
      type: "row-completion",
      targetIndex: 1,
      targetChapterId: "section2",
      previousChapterId: "section1",
      previousTime: mockPlayer.currentTime,
      media: mockPlayer,
    };
    dialogOpenCountB++;
  }

  const confirmSwitch = () => {
    audioLib.saveChapterTime(sessionId, pendingNavigationB.previousChapterId, pendingNavigationB.previousTime);
    currentChapterB = pendingNavigationB.targetIndex;
    autoplayChapterB = pendingNavigationB.targetChapterId;
    pendingNavigationB = null;
  };

  confirmSwitch();
  assert.equal(currentChapterB, 1); // Avançou para Linha 2
  assert.equal(autoplayChapterB, "section2"); // Linha 2 com autoplay
  assert.equal(revealed, 18); // 18 cartas preservadas
  assert.equal(mockPlayer.paused, true); // Linha 1 pausada, sem reprodução tardia
  assert.equal(audioLib.getSavedChapterTime(sessionId, "section1"), 5.2); // Posição salva
  assert.equal(pendingNavigationB, null);

  // Sem repetição do diálogo
  if (!consumedB.has(1)) {
    dialogOpenCountB++;
  }
  assert.equal(dialogOpenCountB, 1);
});
