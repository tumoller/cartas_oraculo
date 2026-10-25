import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { pcmStartTime } from "../src/lib/live-playback.ts";

test("áudio mantém reserva inicial e sequência contínua, retomando após atraso", () => {
  const first = pcmStartTime(10, 0);
  assert.equal(first, 10.18);
  const second = pcmStartTime(10.1, first + 0.4);
  assert.equal(second, first + 0.4);
  assert.equal(pcmStartTime(12, second + 0.4), 12.18);
});
import {
  createLiveToken,
  liveInstruction,
  releaseFailedLiveTrial,
  reserveLiveTrial,
} from "../src/lib/live.ts";

test("a instrução usa somente a leitura recebida e proíbe nova tiragem", () => {
  const prompt = liveInstruction({
    userName: "Ana", persona: "Cigana", theme: "Trabalho",
    cardsDrawn: [{ name: "Sol" }],
    aiReading: { sections: [{ id: "a", text: "Momento de clareza" }] },
  });
  assert.match(prompt, /não sorteie/i);
  assert.match(prompt, /Momento de clareza/);
  assert.match(prompt, /"Sol"/);
});

test("uma leitura só pode reservar um teste", async () => {
  const id = randomUUID();
  const first = await reserveLiveTrial(id);
  try {
    await assert.rejects(() => reserveLiveTrial(id), { code: "EEXIST" });
    assert.ok(Date.parse(first.expiresAt) > Date.now());
  } finally {
    await releaseFailedLiveTrial(first.marker);
  }
});

test("token efêmero prende modelo, contexto e validade", async () => {
  const originalFetch = globalThis.fetch;
  let body;
  const providerNow = Date.now() + 85_000;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("/models")) return new Response("{}", { headers: { date: new Date(providerNow).toUTCString() } });
    body = JSON.parse(options.body);
    return Response.json({ name: "temporary-token" });
  };
  try {
    const expiry = new Date(Date.now() + 180_000).toISOString();
    assert.equal(await createLiveToken("server-key", "leitura salva", expiry), "temporary-token");
    assert.equal(body.uses, 1);
    assert.ok(Math.abs(Date.parse(body.expireTime) - providerNow - 180_000) < 2_000);
    assert.equal(body.bidiGenerateContentSetup.model, "models/gemini-3.8-live");
    assert.equal(body.bidiGenerateContentSetup.generationConfig.maxOutputTokens, 2048);
    assert.equal(body.bidiGenerateContentSetup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, "Gacrux");
    assert.equal(body.bidiGenerateContentSetup.systemInstruction.parts[0].text, "leitura salva");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
