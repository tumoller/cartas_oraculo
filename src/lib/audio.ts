import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AiReading } from "@/types";

export const AUDIO_CHAPTERS = ["card1", "card2", "card3", "card4", "card5", "synthesis"] as const;
export type AudioChapter = string;

type Reading = AiReading & { spread?: string; sections?: { id: string; title: string; positions: number[]; text: string }[] };

export function audioChapters(reading: Reading): { chapter: string; title: string }[] {
  if (reading.spread === "line5") return [{ chapter: "synthesis", title: "Leitura das cinco cartas" }];
  const sections = Array.isArray(reading.sections) ? reading.sections : [];
  const rowCount = reading.spread === "line3" ? 1 : reading.spread === "box9" ? 3 : reading.spread === "grand36" ? 4
    : sections[0]?.positions?.length === 3 && sections.length === 1 ? 1
      : sections[0]?.positions?.length === 3 && sections.length >= 3 ? 3
        : sections[0]?.positions?.length === 9 && sections.length >= 4 ? 4 : 0;
  if (!rowCount) return [{ chapter: "synthesis", title: "Leitura das cinco cartas" }];
  const rows = sections.slice(0, rowCount).map((section, index) => ({ chapter: `section${index + 1}`, title: section.title || `Linha ${index + 1}` }));
  return rowCount === 1 ? rows : [...rows, { chapter: "synthesis", title: "Resumo final" }];
}

export function chapterText(reading: Reading, chapter: AudioChapter): string {
  const section = /^section([1-9]\d*)$/.exec(chapter);
  if (section && Array.isArray(reading.sections)) {
    const text = reading.sections[Number(section[1]) - 1]?.text;
    if (typeof text !== "string" || !text.trim()) throw new Error(`Texto ausente: ${chapter}`);
    return text.trim();
  }
  const text = {
    card1: reading.card1Reading,
    card2: reading.card2Reading,
    card3: [reading.card3Teaser, reading.card3Full].join("\n\n"),
    card4: reading.card4Reading,
    card5: reading.card5Reading,
    synthesis: reading.generalSynthesis,
  }[chapter as (typeof AUDIO_CHAPTERS)[number]];
  if (typeof text !== "string" || !text.trim()) throw new Error(`Texto ausente: ${chapter}`);
  return text.trim();
}

export function audioConfig(persona: string) {
  // Vozes de catálogo provisórias; a aprovação das três personagens exige escuta humana.
  const voice = persona === "Cigana Tradicional" ? "Sulafat"
    : persona === "Linha de Umbanda" ? "Kore" : "Aoede";
  const style = persona === "Cigana Tradicional" ? "Português brasileiro, voz madura, acolhedora e direta, ritmo calmo."
    : persona === "Linha de Umbanda" ? "Português brasileiro, voz serena e respeitosa, sem imitar autoridade religiosa, ritmo calmo."
      : "Português brasileiro, voz acolhedora e contemplativa, ritmo calmo.";
  return { model: process.env.ORACLE_TTS_MODEL || "gemini-3.8-flash-tts", voice, style };
}

export function audioKey(text: string, config: ReturnType<typeof audioConfig>): string {
  return createHash("sha256").update(JSON.stringify({ text, ...config })).digest("hex");
}

export function audioRoot(): string {
  return process.env.ORACLE_AUDIO_DIR || path.join(process.cwd(), ".data", "audio");
}

export function audioPaths(key: string) {
  const root = audioRoot();
  return {
    job: path.join(root, "jobs", `${key}.json`),
    state: path.join(root, "state", `${key}.json`),
    file: path.join(root, "files", `${key}.wav`),
  };
}

export function chapterJob(reading: Reading, persona: string, chapter: AudioChapter) {
  const text = chapterText(reading, chapter);
  const config = audioConfig(persona);
  return { key: audioKey(text, config), text, ...config };
}

export async function enqueueAudio(job: ReturnType<typeof chapterJob>): Promise<void> {
  const paths = audioPaths(job.key);
  await fs.mkdir(path.dirname(paths.job), { recursive: true });
  try {
    await fs.access(paths.file);
    return;
  } catch { /* no cached audio */ }
  try {
    await fs.access(paths.job);
    return;
  } catch { /* first request */ }
  const temp = `${paths.job}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(job), { flag: "wx", mode: 0o600 });
  try {
    await fs.link(temp, paths.job); // atomic create: concurrent requests never replace a queued job
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  } finally {
    await fs.unlink(temp);
  }
}

export async function audioStatus(job: ReturnType<typeof chapterJob>): Promise<"not_started" | "pending" | "generating" | "ready" | "failed"> {
  const paths = audioPaths(job.key);
  try {
    const stat = await fs.stat(paths.file);
    if (stat.size > 44) return "ready";
  } catch { /* no complete audio */ }
  try {
    const state = JSON.parse(await fs.readFile(paths.state, "utf8"));
    if (state.status === "failed") return "failed";
    if (state.status === "generating") return "generating";
  } catch { /* state not yet written */ }
  try {
    await fs.access(paths.job);
    return "pending";
  } catch { return "not_started"; }
}
