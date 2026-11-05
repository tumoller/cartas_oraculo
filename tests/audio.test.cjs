process.env.ORACLE_TTS_GAP_MS = "0";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");
const worker = require("../scripts/audio-worker.cjs");

const filename = path.resolve(__dirname, "../src/lib/audio.ts");
const source = require("node:fs").readFileSync(filename, "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(compiled, filename);
const audio = loaded.exports;

const reading = {
  card1Reading: "A primeira carta pede atenção.", card2Reading: "A segunda amplia o contexto.",
  card3Teaser: "No centro surge uma escolha.", card3Full: "A escolha liga as cartas vizinhas.",
  card4Reading: "A quarta carta abre uma hipótese.", card5Reading: "A quinta pede verificação.",
  generalSynthesis: "Compare a linha com os fatos.",
};

test("áudio oferece capítulos da leitura e síntese sem duplicar tiragem única", () => {
  assert.deepEqual(audio.audioChapters(reading), [{ chapter: "synthesis", title: "Leitura das cinco cartas" }]);
  assert.deepEqual(audio.audioChapters({ ...reading, spread: "line5" }).map((item) => item.chapter), ["synthesis"]);
  assert.equal(audio.chapterText(reading, "card3"), `${reading.card3Teaser}\n\n${reading.card3Full}`);
  const three = { ...reading, spread: "line3", sections: [{ id: "section1", title: "Linha", positions: [1, 2, 3], text: "Leitura da linha" }] };
  assert.deepEqual(audio.audioChapters(three).map((item) => item.chapter), ["section1"]);
  assert.deepEqual(audio.audioChapters({ ...three, spread: undefined }).map((item) => item.chapter), ["section1"]);
  assert.equal(audio.chapterText(three, "section1"), "Leitura da linha");
  assert.throws(() => audio.chapterText(three, "section2"), /Texto ausente/);
  const nine = { ...three, spread: "box9", sections: Array.from({ length: 5 }, (_, i) => ({ id: `section${i + 1}`, title: `Capítulo ${i + 1}`, positions: [1, 2, 3], text: `Texto ${i + 1}` })) };
  assert.deepEqual(audio.audioChapters(nine).map((item) => item.chapter), ["section1", "section2", "section3", "section4", "section5", "synthesis"]);
  assert.deepEqual(audio.audioChapters({ ...nine, spread: undefined }).map((item) => item.chapter), ["section1", "section2", "section3", "section4", "section5", "synthesis"]);
  const grand = { ...nine, spread: "grand36", sections: Array.from({ length: 6 }, (_, i) => ({ id: `section${i + 1}`, title: `Capítulo ${i + 1}`, positions: [1, 2, 3, 4, 5, 6, 7, 8, 9], text: `Texto ${i + 1}` })) };
  assert.deepEqual(audio.audioChapters(grand).map((item) => item.chapter), ["section1", "section2", "section3", "section4", "section5", "section6", "synthesis"]);
  assert.deepEqual(audio.audioChapters({ ...grand, spread: undefined }).map((item) => item.chapter), ["section1", "section2", "section3", "section4", "section5", "section6", "synthesis"]);
});

test("fila durável e WAV reutilizado sem segunda chamada paga", async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "oracle-audio-"));
  const priorRoot = process.env.ORACLE_AUDIO_DIR;
  const priorKey = process.env.GEMINI_API_KEY;
  process.env.ORACLE_AUDIO_DIR = folder;
  process.env.GEMINI_API_KEY = "test-only";
  try {
    const job = audio.chapterJob(reading, "Oráculo da Galáxia", "synthesis");
    await Promise.all([audio.enqueueAudio(job), audio.enqueueAudio(job)]);
    assert.equal((await fs.readdir(path.join(folder, "jobs"))).filter((name) => name.endsWith(".json")).length, 1);
    assert.equal(await audio.audioStatus(job), "pending");
    const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE"), Buffer.alloc(64)]);
    let calls = 0;
    const mockFetch = async (url, options) => {
      calls++;
      assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/interactions");
      const body = JSON.parse(options.body);
      assert.equal(body.model, "gemini-3.8-flash-tts");
      assert.equal(body.input[0].content[0].text, reading.generalSynthesis);
      assert.equal(body.response_format.type, "audio");
      return { ok: true, json: async () => ({ steps: [{ type: "model_output", content: [{ type: "audio", data: wav.toString("base64") }] }] }) };
    };
    await worker.runOnce(mockFetch);
    assert.equal(await audio.audioStatus(job), "ready");
    await audio.enqueueAudio(job);
    await worker.runOnce(mockFetch);
    assert.equal(calls, 1);
    assert.deepEqual(await fs.readFile(audio.audioPaths(job.key).file), wav);
  } finally {
    if (priorRoot === undefined) delete process.env.ORACLE_AUDIO_DIR; else process.env.ORACLE_AUDIO_DIR = priorRoot;
    if (priorKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = priorKey;
    await fs.rm(folder, { recursive: true, force: true });
  }
});

test("erro permanente encerra o job e não repete cobrança", async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "oracle-audio-"));
  const priorRoot = process.env.ORACLE_AUDIO_DIR;
  const priorKey = process.env.GEMINI_API_KEY;
  process.env.ORACLE_AUDIO_DIR = folder;
  process.env.GEMINI_API_KEY = "test-only";
  try {
    const job = audio.chapterJob(reading, "Linha de Umbanda", "card2");
    await audio.enqueueAudio(job);
    let calls = 0;
    const mockFetch = async () => { calls++; return { ok: false, status: 400 }; };
    await worker.runOnce(mockFetch);
    assert.equal(await audio.audioStatus(job), "failed");
    await worker.runOnce(mockFetch);
    assert.equal(calls, 1);
  } finally {
    if (priorRoot === undefined) delete process.env.ORACLE_AUDIO_DIR; else process.env.ORACLE_AUDIO_DIR = priorRoot;
    if (priorKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = priorKey;
    await fs.rm(folder, { recursive: true, force: true });
  }
});

test("erro transitório respeita espera e para após três tentativas", async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "oracle-audio-"));
  const priorRoot = process.env.ORACLE_AUDIO_DIR;
  const priorKey = process.env.GEMINI_API_KEY;
  process.env.ORACLE_AUDIO_DIR = folder;
  process.env.GEMINI_API_KEY = "test-only";
  try {
    const job = audio.chapterJob(reading, "Cigana Tradicional", "synthesis");
    await audio.enqueueAudio(job);
    let calls = 0;
    const mockFetch = async () => { calls++; return { ok: false, status: 429 }; };
    await worker.runOnce(mockFetch);
    await worker.runOnce(mockFetch);
    assert.equal(calls, 1);
    for (let i = 1; i < 3; i++) {
      const stateFile = audio.audioPaths(job.key).state;
      const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
      await fs.writeFile(stateFile, JSON.stringify({ ...state, nextAttemptAt: 0 }));
      await worker.runOnce(mockFetch);
    }
    assert.equal(calls, 3);
    assert.equal(await audio.audioStatus(job), "failed");
    await worker.runOnce(mockFetch);
    assert.equal(calls, 3);
  } finally {
    if (priorRoot === undefined) delete process.env.ORACLE_AUDIO_DIR; else process.env.ORACLE_AUDIO_DIR = priorRoot;
    if (priorKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = priorKey;
    await fs.rm(folder, { recursive: true, force: true });
  }
});

test("trava local impede segundo worker e libera porta ao fechar", async () => {
  const first = await worker.acquireWorkerLock("test-audio", 0);
  const port = first.address().port;
  try {
    await assert.rejects(worker.acquireWorkerLock("test-audio", port), { code: "EADDRINUSE" });
  } finally {
    await new Promise((resolve) => first.close(resolve));
  }
  const second = await worker.acquireWorkerLock("test-audio", port);
  await new Promise((resolve) => second.close(resolve));
});
