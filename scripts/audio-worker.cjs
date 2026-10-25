const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const root = () => process.env.ORACLE_AUDIO_DIR || path.join(process.cwd(), ".data", "audio");
const paths = (key) => ({
  job: path.join(root(), "jobs", `${key}.json`),
  state: path.join(root(), "state", `${key}.json`),
  file: path.join(root(), "files", `${key}.wav`),
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function atomicWrite(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temp, data, { flag: "wx", mode: 0o600 });
  try { await fs.rename(temp, file); }
  finally { await fs.rm(temp, { force: true }); }
}

async function generate(job, fetcher = fetch) {
  if (!process.env.GEMINI_API_KEY) throw Object.assign(new Error("GEMINI_API_KEY ausente"), { transient: false });
  const response = await fetcher("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      model: job.model,
      input: [{ type: "user_input", content: [{ type: "text", text: job.text, annotations: [{ type: "speech_metadata", style: job.style }] }] }],
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice: job.voice }] },
    }),
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok) {
    const error = new Error(`Gemini TTS HTTP ${response.status}`);
    error.transient = response.status === 408 || response.status === 429 || response.status >= 500;
    throw error;
  }
  const data = await response.json();
  const audio = data.steps?.flatMap((step) => step.type === "model_output" ? step.content || [] : [])
    .filter((item) => item.type === "audio" && typeof item.data === "string").at(-1)?.data;
  if (!audio) throw Object.assign(new Error("Resposta TTS sem áudio"), { transient: true });
  const bytes = Buffer.from(audio, "base64");
  if (bytes.length <= 44 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") {
    throw Object.assign(new Error("WAV inválido"), { transient: true });
  }
  return bytes;
}

async function processJob(file, fetcher = fetch) {
  const job = JSON.parse(await fs.readFile(file, "utf8"));
  if (!/^[a-f0-9]{64}$/.test(job.key) || path.basename(file) !== `${job.key}.json` ||
      !job.text || !job.model || !job.voice || !job.style ||
      crypto.createHash("sha256").update(JSON.stringify({ text: job.text, model: job.model, voice: job.voice, style: job.style })).digest("hex") !== job.key) {
    throw new Error("Job de áudio inválido");
  }
  const target = paths(job.key);
  try { if ((await fs.stat(target.file)).size > 44) return "ready"; } catch { /* not ready */ }
  if (!process.env.GEMINI_API_KEY) return "pending";
  let state = { attempts: 0, status: "pending" };
  try { state = JSON.parse(await fs.readFile(target.state, "utf8")); } catch { /* first attempt */ }
  if (state.status === "failed" || state.attempts >= 3) return "failed";
  if (state.nextAttemptAt && Date.now() < state.nextAttemptAt) return "pending";
  const attempts = (state.attempts || 0) + 1;
  await atomicWrite(target.state, JSON.stringify({ status: "generating", attempts }));
  try {
    const bytes = await generate(job, fetcher);
    // A completed file is immutable. Repeated requests and later worker runs reuse it.
    await atomicWrite(target.file, bytes);
    await atomicWrite(target.state, JSON.stringify({ status: "ready", attempts }));
    return "ready";
  } catch (error) {
    const transient = error.transient !== false;
    const retry = transient && attempts < 3;
    await atomicWrite(target.state, JSON.stringify({ status: retry ? "pending" : "failed", attempts, nextAttemptAt: retry ? Date.now() + 1000 * 30 * attempts : null, error: error.message }));
    console.error(`[audio-worker] ${job.key}: ${error.message}`);
    return retry ? "pending" : "failed";
  }
}

async function runOnce(fetcher = fetch) {
  let jobs;
  try { jobs = await fs.readdir(path.join(root(), "jobs")); } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const name of jobs.filter((name) => /^[a-f0-9]{64}\.json$/.test(name))) {
    try { await processJob(path.join(root(), "jobs", name), fetcher); }
    catch (error) { console.error(`[audio-worker] ${name}: ${error.message}`); }
  }
}

async function main() {
  require("@next/env").loadEnvConfig(process.cwd());
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY ausente; fila preservada para próxima inicialização");
  await fs.mkdir(root(), { recursive: true });
  const lock = path.join(root(), "worker.lock");
  try {
    await fs.writeFile(lock, String(process.pid), { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const previous = Number(await fs.readFile(lock, "utf8"));
    try { process.kill(previous, 0); throw new Error(`Worker já ativo (PID ${previous})`); }
    catch (check) { if (check.code !== "ESRCH") throw check; }
    await fs.rm(lock, { force: true });
    await fs.writeFile(lock, String(process.pid), { flag: "wx" });
  }
  const release = () => { fs.rm(lock, { force: true }).catch(() => {}); };
  process.on("SIGINT", () => { release(); process.exit(0); });
  process.on("SIGTERM", () => { release(); process.exit(0); });
  try {
    do { await runOnce(); if (process.argv.includes("--once")) break; await sleep(3000); } while (true);
  } finally { await fs.rm(lock, { force: true }); }
}

module.exports = { generate, processJob, runOnce };
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
