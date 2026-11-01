"use client";
import { useEffect, useRef, useState } from "react";
import { ReadingBoard } from "@/components/ReadingBoard";
import { SpreadBoard } from "@/components/SpreadBoard";
import { setSoundPreference } from "@/lib/sound-preference";
import { resetAudioTracking } from "@/lib/consultation-audio";
import type { ReadingSessionPayload } from "@/types";
import deck from "@/data/baralho.json";

export default function Preview() {
  const [count, setCount] = useState(5);
  const [sound, setSound] = useState(true);
  const [requests, setRequests] = useState<string[]>([]);
  const [voice, setVoice] = useState("parada");
  const [delayedAudio, setDelayedAudio] = useState(false);
  const [releasedAudio, setReleasedAudio] = useState(false);
  const [errorAudio, setErrorAudio] = useState(false);
  const [paidOverride, setPaidOverride] = useState(false);
  const [sessionIndex, setSessionIndex] = useState(0);
  const sessionRef = useRef<ReadingSessionPayload | null>(null);
  const jobsRef = useRef(new Set<string>());
  const delayedRef = useRef(delayedAudio);
  const releasedRef = useRef(releasedAudio);
  const errorRef = useRef(errorAudio);

  useEffect(() => {
    delayedRef.current = delayedAudio;
    releasedRef.current = releasedAudio;
    errorRef.current = errorAudio;
  }, [delayedAudio, releasedAudio, errorAudio]);

  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const url = String(input);
      if (!url.includes("/api/reading/ui-preview-")) return original(input, init);
      if (url.includes("/unlock")) {
        setPaidOverride(true);
        return Response.json({
          ok: true,
          session: {
            ...sessionRef.current,
            isPaid: true,
          },
        });
      }
      let chapter: string | null = null;
      if (init?.method === "POST" && init?.body) {
        try {
          chapter = JSON.parse(String(init.body)).chapter;
        } catch {}
      }
      if (!chapter) {
        try {
          chapter = new URL(url, location.origin).searchParams.get("chapter");
        } catch {}
      }
      if (init?.method === "POST" && chapter) {
        jobsRef.current.add(chapter);
        setRequests((prior) => [...prior, chapter]);
      }
      if (errorRef.current && chapter) {
        const audioErr = { chapter, status: "failed" };
        return Response.json(init?.method === "POST" ? { chapters: [audioErr] } : audioErr);
      }
      const isPending = delayedRef.current && !releasedRef.current;
      const status = !chapter || !jobsRef.current.has(chapter) ? "not_started" : isPending ? "pending" : "ready";
      const audio = {
        chapter,
        status,
        url: "/audio/simulated-long-narration.wav",
      };
      return Response.json(init?.method === "POST" ? { chapters: [audio] } : audio);
    };
    const onVoice = (event: Event) => setVoice((event as CustomEvent).detail.active ? "falando" : "parada");
    window.addEventListener("oracle-voice-state", onVoice);
    setSoundPreference(sound);
    return () => {
      window.fetch = original;
      window.removeEventListener("oracle-voice-state", onVoice);
    };
  }, [sound]);

  const changeSpread = (n: number) => {
    resetAudioTracking();
    jobsRef.current.clear();
    setRequests([]);
    setPaidOverride(false);
    delayedRef.current = false;
    releasedRef.current = false;
    errorRef.current = false;
    setDelayedAudio(false);
    setReleasedAudio(false);
    setErrorAudio(false);
    setSessionIndex((prev) => prev + 1);
    setCount(n);
  };

  const spread = count === 3 ? "line3" : count === 5 ? "line5" : count === 9 ? "box9" : "grand36";
  const columns = count === 36 ? 9 : count === 9 ? 3 : count;
  const sections = Array.from({ length: count / columns }, (_, row) => ({
    id: `section${row + 1}`,
    title: `Linha ${row + 1}`,
    positions: Array.from({ length: columns }, (_, i) => row * columns + i + 1),
    text: "Leitura de teste da linha. O Cavaleiro traz movimento e a Casa o aproxima das questões do lar.",
  }));
  if (count === 9)
    sections.push(
      { id: "section4", title: "Colunas", positions: [1, 4, 7, 2, 5, 8, 3, 6, 9], text: "Relações de teste" },
      { id: "section5", title: "Diagonais", positions: [1, 5, 9, 3, 7], text: "Relações de teste" }
    );
  if (count === 36)
    sections.push(
      { id: "section5", title: "Vizinhança do tema", positions: [12, 13, 14, 21, 22, 23, 30, 31, 32], text: "Vizinhança de teste" },
      { id: "section6", title: "Quatro cantos", positions: [1, 9, 28, 36], text: "Cantos de teste" }
    );
  const text =
    "O Cavaleiro traz movimento, enquanto a Casa concentra a leitura no que oferece segurança. Síntese de teste controlado, sem geração externa.";
  const session: ReadingSessionPayload = {
    id: `ui-preview-${count}-${sound}-${sessionIndex}`,
    userName: "Teste visual",
    persona: "Oráculo da Galáxia",
    theme: "Amizades & Caminhos",
    spread,
    readingDepth: "complete",
    methodVersion: spread === "line5" ? "lenormand-line-v1" : `lenormand-${spread}-v2`,
    cardsDrawn: deck.slice(0, count).map((card, i) => ({
      ...card,
      polarity: null,
      imageUrl: `/cards/cosmico/card-${card.id}.jpg`,
      position: i + 1,
    })),
    sections: count === 5 ? undefined : sections,
    cardNotes: deck.slice(0, count).map((_, i) => ({ position: i + 1, text: "Nota de teste desta carta." })),
    aiReading: {
      card1Reading: text,
      card2Reading: text,
      card3Teaser: text,
      card3Full: text,
      card4Reading: text,
      card5Reading: text,
      generalSynthesis: text,
    },
    isPaid: count === 5 ? paidOverride : true,
    createdAt: "2026-10-29T12:00:00Z",
  };
  useEffect(() => {
    sessionRef.current = session;
  });

  return (
    <main className="p-3">
      <nav className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        {[3, 5, 9, 36].map((n) => (
          <button
            className={`rounded border p-2 ${count === n ? "bg-amber-400/20 border-amber-300 text-amber-200" : "border-slate-600 text-slate-300"}`}
            key={n}
            onClick={() => changeSpread(n)}
          >
            Teste {n}
          </button>
        ))}
        <button
          className={`rounded border p-2 ${sound ? "border-amber-300 text-amber-200" : "border-slate-600 text-slate-400"}`}
          onClick={() => {
            const next = !sound;
            setSoundPreference(next);
            setSound(next);
          }}
        >
          {sound ? "Com som" : "Sem som"}
        </button>
        <button
          className={`rounded border p-2 ${delayedAudio ? "bg-amber-500/20 border-amber-300 text-amber-200" : "border-slate-600 text-slate-300"}`}
          onClick={() => {
            const next = !delayedAudio;
            delayedRef.current = next;
            releasedRef.current = false;
            jobsRef.current.clear();
            setRequests([]);
            resetAudioTracking();
            setDelayedAudio(next);
            setReleasedAudio(false);
            setSessionIndex((prev) => prev + 1);
          }}
        >
          {delayedAudio ? "Atraso: ATIVO" : "Atraso: INATIVO"}
        </button>
        {delayedAudio && (
          <button
            className="rounded border border-emerald-400 bg-emerald-500/20 p-2 text-emerald-200 font-semibold"
            onClick={() => {
              releasedRef.current = true;
              setReleasedAudio(true);
              window.dispatchEvent(new CustomEvent("oracle-audio-ready"));
            }}
          >
            Liberar áudio pronto
          </button>
        )}
        <button
          className={`rounded border p-2 ${errorAudio ? "bg-rose-500/20 border-rose-300 text-rose-200" : "border-slate-600 text-slate-300"}`}
          onClick={() => {
            const next = !errorAudio;
            errorRef.current = next;
            setErrorAudio(next);
          }}
        >
          {errorAudio ? "Erro: ATIVO" : "Erro: INATIVO"}
        </button>
        {count === 5 && !paidOverride && (
          <button
            className="rounded border border-cyan-400 bg-cyan-500/20 p-2 text-cyan-200 font-semibold"
            onClick={() => {
              setPaidOverride(true);
              window.dispatchEvent(new CustomEvent("oracle-test-unlock", { detail: { sessionId: session.id } }));
            }}
          >
            Simular desbloqueio 5 cartas
          </button>
        )}
        <p className="w-full text-slate-400">
          Pedidos: <span className="font-mono text-amber-200">{requests.join(", ") || "nenhum"}</span> (Total:{" "}
          <span className="font-mono font-bold text-white">{requests.length}</span>) · Voz:{" "}
          <span className="font-semibold text-cyan-300">{voice}</span>
        </p>
      </nav>
      {count === 5 ? (
        <ReadingBoard
          key={session.id}
          initialSession={session}
          initialNarration={sound}
          onReset={() => {}}
        />
      ) : (
        <SpreadBoard
          key={session.id}
          session={session}
          initialNarration={sound}
          onReset={() => {}}
        />
      )}
    </main>
  );
}
