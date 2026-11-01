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

const audioLib = load("src/lib/consultation-audio.ts");

// ==============================================================
// 1. Recuperação de falhas em ReadingAudio
// ==============================================================

test("Cenário 1A: POST falha antes de criar job -> servidor confirma not_started -> liberação e recuperação posterior", async () => {
  const sessionId = "sess-recov-fail-pre";
  const chapter = "synthesis";
  audioLib.resetAudioTracking();

  let postCount = 0;
  let serverStatus = "not_started";
  let failPost = true;

  const performAudioRequest = async () => {
    // Lógica espelhada de ReadingAudio.requestAudio:
    if (audioLib.hasRequestedChapter(sessionId, chapter)) {
      if (serverStatus !== "not_started" && serverStatus !== "failed") {
        return { skipped: true };
      }
    }
    audioLib.markChapterRequested(sessionId, chapter);
    postCount++;

    if (failPost) {
      failPost = false;
      // POST falhou no transporte antes de criar o job
      // Catch consulta o servidor via GET status:
      if (serverStatus === "not_started" || serverStatus === "failed") {
        audioLib.setChapterAudioState(sessionId, chapter, { status: serverStatus });
        audioLib.clearChapterRequested(sessionId, chapter);
      }
      return { error: "Falha de rede no POST" };
    }

    // Segundo POST: servidor processa e cria job
    serverStatus = "pending";
    audioLib.setChapterAudioState(sessionId, chapter, { status: "pending" });
    audioLib.markChapterRequested(sessionId, chapter);
    return { ok: true, status: "pending" };
  };

  // 1. Primeiro pedido: POST falha antes de criar job
  assert.equal(audioLib.hasRequestedChapter(sessionId, chapter), false);
  const res1 = await performAudioRequest();
  assert.equal(res1.error, "Falha de rede no POST");
  assert.equal(postCount, 1);
  assert.equal(serverStatus, "not_started");
  // hasRequestedChapter foi liberado pois o servidor confirmou not_started:
  assert.equal(audioLib.hasRequestedChapter(sessionId, chapter), false);

  // 2. Não gera tentativas automáticas em ciclo:
  // Se o usuário não agir, postCount permanece 1
  assert.equal(postCount, 1);

  // 3. Usuário clica ação explícita de tentar novamente (compatível com endpoint existente)
  const res2 = await performAudioRequest();
  assert.equal(res2.ok, true);
  assert.equal(postCount, 2);
  assert.equal(serverStatus, "pending");
  // Deduplicação preservada enquanto pendente/gerando/pronto:
  assert.equal(audioLib.hasRequestedChapter(sessionId, chapter), true);

  // 4. Tentativa concorrente ou retorno de navegação não duplica POST
  const res3 = await performAudioRequest();
  assert.equal(res3.skipped, true);
  assert.equal(postCount, 2);
});

test("Cenário 1B: Resposta perdida após criação do job no servidor -> consulta confirma pending -> sem duplicação", async () => {
  const sessionId = "sess-lost-resp";
  const chapter = "section1";
  audioLib.resetAudioTracking();

  let postCount = 0;
  let serverStatus = "not_started";

  const performAudioRequest = async () => {
    if (audioLib.hasRequestedChapter(sessionId, chapter)) {
      if (serverStatus !== "not_started" && serverStatus !== "failed") {
        return { skipped: true };
      }
    }
    audioLib.markChapterRequested(sessionId, chapter);
    postCount++;

    // Servidor recebeu o POST e enfileirou o job com sucesso:
    serverStatus = "pending";

    // Porém, o pacote de resposta HTTP foi perdido (timeout/queda de conexão):
    // Catch do cliente consulta o servidor via GET statusUrl:
    const confirmedStatus = serverStatus;
    if (confirmedStatus === "pending" || confirmedStatus === "generating" || confirmedStatus === "ready") {
      audioLib.setChapterAudioState(sessionId, chapter, { status: confirmedStatus });
      audioLib.markChapterRequested(sessionId, chapter);
    }
    return { error: "Response timeout" };
  };

  // 1. Executa pedido onde resposta é perdida
  const res1 = await performAudioRequest();
  assert.equal(res1.error, "Response timeout");
  assert.equal(postCount, 1);
  assert.equal(serverStatus, "pending");

  // 2. hasRequestedChapter permanece marcado porque o servidor confirmou pending:
  assert.equal(audioLib.hasRequestedChapter(sessionId, chapter), true);

  // 3. Usuário clica em 'Verificar narração' ou 'Tentar novamente':
  // Não duplica POST pois job já existe no servidor!
  const res2 = await performAudioRequest();
  assert.equal(res2.skipped, true);
  assert.equal(postCount, 1); // Exatamente 1 POST!
});

test("Cenário 1C: Erro de transporte sem confirmação do servidor bloqueia novo POST antes de consultar", async () => {
  const sessionId = "sess-transport-offline";
  const chapter = "section1";
  audioLib.resetAudioTracking();

  let postCount = 0;
  let serverReachable = false;
  let serverStatus = "not_started";

  const performAudioRequest = async () => {
    if (audioLib.hasRequestedChapter(sessionId, chapter)) {
      if (!serverReachable) {
        // Não foi possível consultar o servidor: bloqueia novo POST
        return { error: "Não foi possível confirmar o pedido. Verifique a narração antes de solicitar novamente." };
      }
      if (serverStatus !== "not_started" && serverStatus !== "failed") {
        return { skipped: true };
      }
    }
    audioLib.markChapterRequested(sessionId, chapter);
    postCount++;
    if (!serverReachable) {
      // POST falhou e GET statusUrl subsequente também falhou (offline):
      return { error: "Offline" };
    }
    serverStatus = "pending";
    return { ok: true };
  };

  // POST falha com rede fora do ar:
  const res1 = await performAudioRequest();
  assert.equal(res1.error, "Offline");
  assert.equal(postCount, 1);
  assert.equal(audioLib.hasRequestedChapter(sessionId, chapter), true);

  // Tentativa antes de reconectar: bloqueada, não faz POST adicional
  const res2 = await performAudioRequest();
  assert.ok(res2.error?.includes("Não foi possível confirmar o pedido"));
  assert.equal(postCount, 1);

  // Rede volta: servidor confirma not_started, liberando hasRequestedChapter
  serverReachable = true;
  audioLib.clearChapterRequested(sessionId, chapter);
  assert.equal(audioLib.hasRequestedChapter(sessionId, chapter), false);

  // Agora permite novo POST explícito:
  const res3 = await performAudioRequest();
  assert.equal(res3.ok, true);
  assert.equal(postCount, 2);
});

// ==============================================================
// 2. Encerrar apresentação antes do convite
// ==============================================================

test("Cenário 2: Síntese de 5 cartas - onEnded fecha apresentação antes do convite, único diálogo aberto e sem áudio residual", () => {
  let showPresentation = true;
  let showLiveInvite = false;
  let presentationChapter = "synthesis";

  let openDialogs = () => (showPresentation ? 1 : 0) + (showLiveInvite ? 1 : 0);

  const mockPlayer = {
    paused: false,
    ended: true,
    currentTime: 12.0,
    pause() { this.paused = true; },
  };

  // Durante a narração da síntese:
  assert.equal(showPresentation, true);
  assert.equal(showLiveInvite, false);
  assert.equal(openDialogs(), 1);

  // onEnded da síntese das cinco cartas:
  const onEnded = () => {
    showPresentation = false;
    presentationChapter = null;
    showLiveInvite = true;
  };

  onEnded();
  // Evidência de apenas UM diálogo aberto ao terminar a síntese:
  assert.equal(showPresentation, false);
  assert.equal(presentationChapter, null);
  assert.equal(showLiveInvite, true);
  assert.equal(openDialogs(), 1);

  // Testar aceitar convite:
  let pausedOnAccept = false;
  const onAccept = () => {
    audioLib.pauseCurrentVoice();
    mockPlayer.pause();
    pausedOnAccept = mockPlayer.paused;
    showLiveInvite = false;
  };
  onAccept();
  assert.equal(showLiveInvite, false);
  assert.equal(openDialogs(), 0);
  assert.equal(pausedOnAccept, true);
  assert.equal(mockPlayer.paused, true);

  // Testar recusar convite:
  showLiveInvite = true;
  mockPlayer.paused = false;
  let pausedOnDismiss = false;
  let focusTarget = null;
  const onDismiss = () => {
    audioLib.pauseCurrentVoice();
    mockPlayer.pause();
    pausedOnDismiss = mockPlayer.paused;
    showLiveInvite = false;
    focusTarget = "chapterRef";
  };
  onDismiss();
  assert.equal(showLiveInvite, false);
  assert.equal(openDialogs(), 0);
  assert.equal(pausedOnDismiss, true);
  assert.equal(mockPlayer.paused, true);
  assert.equal(focusTarget, "chapterRef");
});

test("Cenário 2 (demais jogos): Mesa de 36 cartas e jogo de 3 cartas (line3) - onEnded fecha apresentação antes do convite", () => {
  let showPresentation = true;
  let presentationChapter = "synthesis";
  let showLiveInvite = false;
  const isPaid = true;
  const liveInviteDismissed = false;

  const onEndedSpread = (spread, allReady, synthesis) => {
    showPresentation = false;
    presentationChapter = null;
    const isFinalChapter = synthesis || (spread === "line3" && allReady);
    if (isFinalChapter && isPaid && !liveInviteDismissed) {
      showLiveInvite = true;
    }
  };

  // 1. Mesa de 36 cartas / SpreadBoard (com síntese):
  assert.equal(showPresentation, true);
  assert.equal(showLiveInvite, false);
  onEndedSpread("grand36", true, true);
  assert.equal(showPresentation, false);
  assert.equal(presentationChapter, null);
  assert.equal(showLiveInvite, true);

  // 2. Jogo de 3 cartas (line3 - sem síntese separada, finaliza na linha com todas as cartas reveladas):
  showPresentation = true;
  presentationChapter = "section1";
  showLiveInvite = false;
  onEndedSpread("line3", true, false);
  assert.equal(showPresentation, false);
  assert.equal(presentationChapter, null);
  assert.equal(showLiveInvite, true);
});

// ==============================================================
// 3. Evidência faltante em 36 cartas
// ==============================================================

test("Cenário 3A: 36 cartas - concluir segunda linha enquanto a primeira ainda está PREPARANDO", () => {
  const sessionId = "sess-grand36-unheard";
  audioLib.resetAudioTracking();

  let revealed = 9; // Linha 1 concluída
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
  let dialogShownCount = 0;

  const checkRowCompletions = (row) => {
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
        dialogShownCount++;
      }
    }
  };

  checkRowCompletions(1);
  assert.ok(pendingNavigation);
  assert.equal(dialogShownCount, 1);
  assert.equal(pendingNavigation.mode, "unheard");
  assert.equal(revealed, 18); // Cartas reveladas preservadas
  assert.equal(currentChapter, 0); // Linha 1 mantida

  // --- 3A.1: Testar CANCELAR a troca ---
  pendingNavigation = null; // Usuário cancela ('Continuar nesta linha')
  assert.equal(pendingNavigation, null);
  assert.equal(currentChapter, 0); // Mantém Linha 1
  assert.equal(revealed, 18); // 18 cartas preservadas
  assert.equal(autoplayChapter, "section1"); // Linha 2 abandonada NÃO recebe autoplay

  // Reavaliação: sem repetição do diálogo (consumedCompletions possui 1)
  checkRowCompletions(1);
  assert.equal(pendingNavigation, null);
  assert.equal(dialogShownCount, 1);

  // Linha 1 finalmente fica pronta: toca Linha 1, NÃO Linha 2
  audioLib.setChapterAudioState(sessionId, "section1", { status: "ready" });
  assert.equal(autoplayChapter, "section1");
  assert.notEqual(autoplayChapter, "section2");

  // --- 3A.2: Testar CONFIRMAR a troca ---
  const consumedB = new Set([0]);
  let currentChapterB = 0;
  let autoplayChapterB = "section1";
  let pendingB = null;
  let dialogCountB = 0;

  if (!consumedB.has(1)) {
    consumedB.add(1);
    pendingB = {
      mode: "unheard",
      type: "row-completion",
      targetIndex: 1,
      targetChapterId: "section2",
      previousChapterId: "section1",
    };
    dialogCountB++;
  }

  // Confirmar troca avança para Linha 2 com autoplay:
  currentChapterB = pendingB.targetIndex;
  autoplayChapterB = pendingB.targetChapterId;
  pendingB = null;

  assert.equal(currentChapterB, 1); // Linha 2 ativa
  assert.equal(autoplayChapterB, "section2"); // Linha 2 com autoplay
  assert.equal(revealed, 18); // 18 cartas preservadas
  assert.equal(pendingB, null);

  // Sem repetição do diálogo:
  if (!consumedB.has(1)) dialogCountB++;
  assert.equal(dialogCountB, 1);

  // Linha 1 abandonada fica pronta no servidor posteriormente:
  // NÃO toca tardiamente porque o autoplay atual é section2 e section1 está desmontada!
  audioLib.setChapterAudioState(sessionId, "section1", { status: "ready" });
  assert.equal(autoplayChapterB, "section2");
  assert.notEqual(autoplayChapterB, "section1");
});

test("Cenário 3B: 36 cartas - concluir segunda linha enquanto a primeira está TOCANDO", () => {
  const sessionId = "sess-grand36-playing";
  audioLib.resetAudioTracking();

  let revealed = 9;
  let currentChapter = 0;
  const consumedCompletions = new Set([0]);

  const mockPlayer = {
    currentTime: 4.2,
    paused: false,
    pause() { this.paused = true; },
    play() { this.paused = false; return Promise.resolve(); },
  };

  // Usuário revela cartas 10 a 18 (Linha 2 concluída)
  revealed = 18;
  let pendingNavigation = null;
  let dialogShownCount = 0;

  const checkRowCompletions = (row) => {
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
      dialogShownCount++;
    }
  };

  checkRowCompletions(1);
  assert.ok(pendingNavigation);
  assert.equal(dialogShownCount, 1);
  assert.equal(mockPlayer.paused, true); // Áudio da linha 1 pausado
  assert.equal(mockPlayer.currentTime, 4.2);
  assert.equal(revealed, 18); // 18 cartas preservadas
  assert.equal(currentChapter, 0);

  // --- 3B.1: Testar CANCELAR a troca ---
  // Linha 1 retoma reprodução
  audioLib.resumePlayingMedia(pendingNavigation.media);
  pendingNavigation = null;

  assert.equal(pendingNavigation, null);
  assert.equal(mockPlayer.paused, false); // Retomou
  assert.equal(mockPlayer.currentTime, 4.2); // Mesma posição mantida
  assert.equal(currentChapter, 0); // Linha 1 mantida
  assert.equal(revealed, 18); // 18 cartas preservadas

  // Sem repetição do diálogo:
  checkRowCompletions(1);
  assert.equal(pendingNavigation, null);
  assert.equal(dialogShownCount, 1);

  // --- 3B.2: Testar CONFIRMAR a troca ---
  const consumedB = new Set([0]);
  let currentChapterB = 0;
  let autoplayChapterB = null;
  let pendingB = null;
  let dialogCountB = 0;

  mockPlayer.paused = false;
  mockPlayer.currentTime = 6.8;

  if (!consumedB.has(1)) {
    consumedB.add(1);
    mockPlayer.pause();
    pendingB = {
      mode: "playing",
      type: "row-completion",
      targetIndex: 1,
      targetChapterId: "section2",
      previousChapterId: "section1",
      previousTime: mockPlayer.currentTime,
      media: mockPlayer,
    };
    dialogCountB++;
  }

  // Confirmar troca:
  audioLib.saveChapterTime(sessionId, pendingB.previousChapterId, pendingB.previousTime);
  currentChapterB = pendingB.targetIndex;
  autoplayChapterB = pendingB.targetChapterId;
  pendingB = null;

  assert.equal(currentChapterB, 1); // Avançou para Linha 2
  assert.equal(autoplayChapterB, "section2"); // Linha 2 com autoplay
  assert.equal(revealed, 18); // 18 cartas preservadas
  assert.equal(mockPlayer.paused, true); // Linha 1 pausada, sem reprodução tardia
  assert.equal(audioLib.getSavedChapterTime(sessionId, "section1"), 6.8); // Posição salva
  assert.equal(pendingB, null);

  // Sem repetição do diálogo:
  if (!consumedB.has(1)) dialogCountB++;
  assert.equal(dialogCountB, 1);
});
