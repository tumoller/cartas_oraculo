const fs = require("node:fs/promises");
const path = require("node:path");
const { generate } = require("./audio-worker.cjs");

async function main() {
  require("@next/env").loadEnvConfig(process.cwd());
  const directory = path.join(process.cwd(), "public", "audio");
  await fs.mkdir(directory, { recursive: true });
  for (const [deck, voice] of [["cosmico", "Aoede"], ["cigano", "Sulafat"], ["umbanda", "Kore"]]) {
    const file = path.join(directory, `welcome-${deck}.wav`);
    try { await fs.access(file); console.log(`${deck}: acolhimento existente preservado`); continue; } catch {}
    const bytes = await generate({ model: process.env.ORACLE_TTS_MODEL || "gemini-3.8-flash-tts", voice, style: "Português brasileiro, acolhedor e calmo.", text: "Reserve este momento para a sua pergunta. Quando estiver pronto, revele as cartas no seu ritmo." });
    await fs.writeFile(file, bytes, { flag: "wx" });
    console.log(`${deck}: acolhimento salvo (${bytes.length} bytes)`);
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
