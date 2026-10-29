"use client";
import { useEffect, useState } from "react";
import { ReadingBoard } from "@/components/ReadingBoard";
import { SpreadBoard } from "@/components/SpreadBoard";
import { setSoundPreference } from "@/lib/sound-preference";
import type { ReadingSessionPayload } from "@/types";
import deck from "@/data/baralho.json";

export default function Preview() {
  const [count, setCount] = useState(5);
  const [sound, setSound] = useState(false);
  const [ready, setReady] = useState(false);
  const [requests, setRequests] = useState<string[]>([]);
  const [voice, setVoice] = useState("parada");
  useEffect(() => {
    const original = window.fetch;
    const jobs = new Set<string>();
    window.fetch = async (input, init) => {
      const url = String(input);
      if (!url.includes("/api/reading/ui-preview-")) return original(input, init);
      const chapter = init?.method === "POST" ? JSON.parse(String(init.body)).chapter : new URL(url, location.origin).searchParams.get("chapter");
      if (init?.method === "POST") { jobs.add(chapter); setRequests((prior) => [...prior, chapter]); }
      const audio = { chapter, status: jobs.has(chapter) ? "ready" : "not_started", url: "/audio/welcome-cosmico.wav" };
      return Response.json(init?.method === "POST" ? { chapters: [audio] } : audio);
    };
    const onVoice = (event: Event) => setVoice((event as CustomEvent).detail.active ? "falando" : "parada");
    window.addEventListener("oracle-voice-state", onVoice);
    setSoundPreference(false);
    setReady(true);
    return () => { window.fetch = original; window.removeEventListener("oracle-voice-state", onVoice); };
  }, []);
  const spread = count === 3 ? "line3" : count === 5 ? "line5" : count === 9 ? "box9" : "grand36";
  const columns = count === 36 ? 9 : count === 9 ? 3 : count;
  const sections = Array.from({ length: count / columns }, (_, row) => ({ id: `section${row + 1}`, title: `Linha ${row + 1}`, positions: Array.from({ length: columns }, (_, i) => row * columns + i + 1), text: "Leitura de teste da linha. O Cavaleiro traz movimento e a Casa o aproxima das questões do lar." }));
  if (count === 9) sections.push({ id: "section4", title: "Colunas", positions: [1, 4, 7, 2, 5, 8, 3, 6, 9], text: "Relações de teste" }, { id: "section5", title: "Diagonais", positions: [1, 5, 9, 3, 7], text: "Relações de teste" });
  if (count === 36) sections.push({ id: "section5", title: "Vizinhança do tema", positions: [12, 13, 14, 21, 22, 23, 30, 31, 32], text: "Vizinhança de teste" }, { id: "section6", title: "Quatro cantos", positions: [1, 9, 28, 36], text: "Cantos de teste" });
  const text = "O Cavaleiro traz movimento, enquanto a Casa concentra a leitura no que oferece segurança. Síntese de teste controlado, sem geração externa.";
  const session: ReadingSessionPayload = {
    id: `ui-preview-${count}-${sound}`, userName: "Teste visual", persona: "Oráculo da Galáxia", theme: "Amizades & Caminhos", spread, readingDepth: "complete", methodVersion: spread === "line5" ? "lenormand-line-v1" : `lenormand-${spread}-v2`,
    cardsDrawn: deck.slice(0, count).map((card, i) => ({ ...card, polarity: null, imageUrl: `/cards/cosmico/card-${card.id}.jpg`, position: i + 1 })),
    sections: count === 5 ? undefined : sections, cardNotes: deck.slice(0, count).map((_, i) => ({ position: i + 1, text: "Nota de teste desta carta." })),
    aiReading: { card1Reading: text, card2Reading: text, card3Teaser: text, card3Full: text, card4Reading: text, card5Reading: text, generalSynthesis: text }, isPaid: true, createdAt: "2026-10-29T12:00:00Z",
  };
  return <main className="p-3"><nav className="mb-3 flex flex-wrap gap-3">{[3, 5, 9, 36].map((n) => <button className="rounded border p-3" key={n} onClick={() => setCount(n)}>Teste {n}</button>)}<button className="rounded border p-3" onClick={() => { setSoundPreference(!sound); setSound(!sound); }}>Teste {sound ? "sem som" : "com som"}</button><p>Pedidos: {requests.join(", ")} · Voz: {voice}</p></nav>{ready && (count === 5 ? <ReadingBoard key={session.id} initialSession={session} initialNarration={sound} onReset={() => {}} /> : <SpreadBoard key={session.id} session={session} initialNarration={sound} onReset={() => {}} />)}</main>;
}
