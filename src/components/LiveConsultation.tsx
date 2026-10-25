"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ReadingSessionPayload } from "@/types";
import { pcmStartTime } from "@/lib/live-playback";
import { setSoundPreference, useSoundPreference } from "@/lib/sound-preference";
import Image from "next/image";
import { sceneAssets } from "@/lib/scene-assets";
import { monitorLiveVoice, setLiveVoiceActive } from "@/lib/consultation-audio";
import { getVoiceVolume } from "@/lib/soundscape";

type Message = { from: "você" | "oráculo"; text: string };
type LiveServerMessage = {
  setupComplete?: object;
  serverContent?: {
    outputTranscription?: { text?: string };
    inputTranscription?: { text?: string };
    interrupted?: boolean;
    turnComplete?: boolean;
    modelTurn?: { parts?: { text?: string; inlineData?: { data?: string; mimeType?: string } }[] };
  };
};

const WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

export function LiveConsultation({ session }: { session: ReadingSessionPayload }) {
  const soundEnabled = useSoundPreference();
  const soundAllowed = useRef(soundEnabled === true);
  soundAllowed.current = soundEnabled === true;
  const [state, setState] = useState<"idle" | "connecting" | "ready" | "ended">("idle");
  const [available, setAvailable] = useState(false);
  const [status, setStatus] = useState("Tire suas dúvidas sobre a leitura em uma conversa de até 3 minutos.");
  const [secondsLeft, setSecondsLeft] = useState(180);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [microphoneOn, setMicrophoneOn] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const playback = useRef<AudioContext | null>(null);
  const output = useRef<GainNode | null>(null);
  const outputMeter = useRef<AnalyserNode | null>(null);
  const voiceMeter = useRef<(() => void) | null>(null);
  const playAt = useRef(0);
  const playing = useRef<AudioBufferSourceNode[]>([]);
  const mic = useRef<{ stream: MediaStream; context: AudioContext; source: MediaStreamAudioSourceNode; processor: ScriptProcessorNode; sink: GainNode } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const draining = useRef(false);
  const replying = useRef(false);
  const expired = useRef(false);

  const stopPlayback = () => {
    draining.current = false;
    playing.current.forEach((node) => { try { node.stop(); } catch { /* already stopped */ } });
    playing.current = [];
    playAt.current = 0;
    voiceMeter.current?.();
    voiceMeter.current = null;
  };

  const stopMic = () => {
    const current = mic.current;
    if (!current) return;
    current.processor.disconnect();
    current.source.disconnect();
    current.sink.disconnect();
    current.stream.getTracks().forEach((track) => track.stop());
    void current.context.close();
    mic.current = null;
    setMicrophoneOn(false);
    window.dispatchEvent(new CustomEvent("oracle-microphone", { detail: { active: false } }));
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
    }
  };

  const end = (message = "Conversa encerrada.", drainAudio = false) => {
    expired.current = true;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stopMic();
    socket.current?.close();
    socket.current = null;
    const context = playback.current;
    if (context && drainAudio && playing.current.length) {
      // O tempo de conversa termina agora; só o áudio já recebido termina de tocar.
      draining.current = true;
    } else {
      stopPlayback();
      if (context) void context.close();
      playback.current = null;
      setLiveVoiceActive(false);
    }
    setState("ended");
    setStatus(message);
  };

  useEffect(() => {
    if (output.current) output.current.gain.value = soundEnabled === true ? getVoiceVolume() : 0;
  }, [soundEnabled]);

  useEffect(() => {
    const volumeChanged = () => { if (output.current) output.current.gain.value = soundAllowed.current ? getVoiceVolume() : 0; };
    window.addEventListener("oracle-voice-volume", volumeChanged);
    return () => window.removeEventListener("oracle-voice-volume", volumeChanged);
  }, []);

  useEffect(() => {
    const silence = () => {
      soundAllowed.current = false;
      if (output.current) output.current.gain.value = 0;
      stopMic();
    };
    window.addEventListener("oracle-sound-off", silence);
    return () => window.removeEventListener("oracle-sound-off", silence);
  }, []);

  useEffect(() => {
    setAvailable(false);
    if (session.isPaid) {
      fetch(`/api/reading/${encodeURIComponent(session.id)}/live`, { cache: "no-store" })
        .then((response) => response.ok ? response.json() : null)
        .then((data: { enabled?: boolean; started?: boolean } | null) => {
          if (!data?.enabled) return;
          setAvailable(true);
          if (data.started) {
            setState("ended");
            setStatus("A conversa desta leitura já foi iniciada.");
          }
        })
        .catch(() => {});
    }
    return () => {
      expired.current = true;
      if (timer.current) clearInterval(timer.current);
      mic.current?.stream.getTracks().forEach((track) => track.stop());
      if (mic.current) void mic.current.context.close();
      window.dispatchEvent(new CustomEvent("oracle-microphone", { detail: { active: false } }));
      socket.current?.close();
      if (playback.current) void playback.current.close();
      voiceMeter.current?.();
      voiceMeter.current = null;
      setLiveVoiceActive(false);
    };
  }, [session.id, session.isPaid]);

  const playPcm = (base64: string, mimeType = "audio/pcm;rate=24000") => {
    const context = playback.current;
    if (!context || expired.current || !/^audio\/pcm(?:;|$)/i.test(mimeType)) return;
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    if (!bytes.length || bytes.length % 2) return;
    const rate = Number(/(?:^|;)\s*rate=(\d+)/i.exec(mimeType)?.[1] || 24000);
    if (rate < 8000 || rate > 96000) return;
    const pcm = new DataView(bytes.buffer);
    const buffer = context.createBuffer(1, bytes.length / 2, rate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = pcm.getInt16(i * 2, true) / 32768;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(output.current ?? context.destination);
    source.onended = () => {
      playing.current = playing.current.filter((item) => item !== source);
      if (draining.current && !playing.current.length && playback.current === context) {
        draining.current = false;
        voiceMeter.current?.();
        voiceMeter.current = null;
        void context.close();
        playback.current = null;
        setLiveVoiceActive(false);
      } else if (!playing.current.length) {
        voiceMeter.current?.();
        voiceMeter.current = null;
      }
    };
    const startAt = pcmStartTime(context.currentTime, playAt.current);
    source.start(startAt);
    playAt.current = startAt + buffer.duration;
    playing.current.push(source);
    if (!voiceMeter.current && outputMeter.current) voiceMeter.current = monitorLiveVoice(outputMeter.current);
  };

  const appendResponse = (part: string) => {
    if (!part) return;
    setMessages((current) => {
      const next = [...current];
      if (replying.current && next[next.length - 1]?.from === "oráculo") {
        next[next.length - 1] = { from: "oráculo", text: next[next.length - 1].text + part };
      } else {
        next.push({ from: "oráculo", text: part });
      }
      replying.current = true;
      return next.slice(-30);
    });
  };

  const start = async () => {
    if (state !== "idle") return;
    setLiveVoiceActive(true);
    setSoundPreference(true);
    setState("connecting");
    setStatus("Preparando conversa...");
    expired.current = false;
    window.dispatchEvent(new CustomEvent("oracle-audio-start", { detail: "live" }));
    try {
      playback.current = new AudioContext();
      output.current = playback.current.createGain();
      output.current.gain.value = getVoiceVolume();
      outputMeter.current = playback.current.createAnalyser();
      outputMeter.current.fftSize = 256;
      output.current.connect(outputMeter.current);
      outputMeter.current.connect(playback.current.destination);
      await playback.current.resume();
      if (expired.current) return;
      const response = await fetch(`/api/reading/${encodeURIComponent(session.id)}/live`, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(35000) });
      const data = await response.json() as { token?: string; model?: string; expiresAt?: string; error?: string };
      if (expired.current) return;
      if (!response.ok || !data.token || !data.model || !data.expiresAt) throw new Error(data.error || "Conversa indisponível.");
      const expires = Date.parse(data.expiresAt);
      if (expired.current || expires <= Date.now()) throw new Error("Não foi possível conectar dentro do tempo disponível. Sua leitura continua salva.");
      const tick = () => {
        const left = Math.max(0, Math.ceil((expires - Date.now()) / 1000));
        setSecondsLeft(left);
        if (left === 0) end("Seu tempo de conversa terminou. Sua leitura continua disponível.", true);
      };
      tick();
      timer.current = setInterval(tick, 1000);
      const ws = new WebSocket(`${WS_URL}?access_token=${encodeURIComponent(data.token)}`);
      ws.binaryType = "arraybuffer";
      socket.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ setup: { model: `models/${data.model}` } }));
      ws.onmessage = (event) => {
        if (expired.current) return;
        let message: LiveServerMessage;
        try { message = JSON.parse(event.data instanceof ArrayBuffer ? new TextDecoder().decode(event.data) : event.data); } catch { return; }
        if (message.setupComplete) {
          setState("ready");
          setStatus("Conectado. Escreva uma pergunta ou ative o microfone.");
        }
        const content = message.serverContent;
        if (!content) return;
        if (content.interrupted) stopPlayback();
        if (content.outputTranscription?.text) appendResponse(content.outputTranscription.text);
        for (const part of content.modelTurn?.parts || []) {
          if (part.inlineData?.data) playPcm(part.inlineData.data, part.inlineData.mimeType);
          if (part.text && !content.outputTranscription?.text) appendResponse(part.text);
        }
        if (content.turnComplete) replying.current = false;
      };
      ws.onerror = () => { if (!expired.current) end("A conversa perdeu a conexão. Sua leitura continua disponível.", true); };
      ws.onclose = () => { if (!expired.current) end("A conversa foi encerrada. Sua leitura continua disponível.", true); };
    } catch (error) {
      end(error instanceof Error && !/fetch|timeout|signal|network|token|Gemini|API/i.test(error.message) ? error.message : "Não foi possível iniciar a conversa. Tente novamente mais tarde.");
    }
  };

  const sendText = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim().slice(0, 500);
    if (!text || socket.current?.readyState !== WebSocket.OPEN || state !== "ready") return;
    socket.current.send(JSON.stringify({ realtimeInput: { text } }));
    setMessages((current) => [...current, { from: "você" as const, text }].slice(-30));
    replying.current = false;
    setDraft("");
  };

  const toggleMic = async () => {
    if (mic.current) { stopMic(); return; }
    if (soundEnabled !== true) {
      setStatus("Ative o som no avatar antes de ligar o microfone.");
      return;
    }
    if (!window.isSecureContext) {
      setStatus("Para usar o microfone, abra a consulta por um endereço seguro. Neste acesso, você pode escrever sua pergunta.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("O microfone não está disponível neste acesso. Você pode escrever sua pergunta.");
      return;
    }
    if (socket.current?.readyState !== WebSocket.OPEN) return;
    let pendingStream: MediaStream | null = null;
    let pendingContext: AudioContext | null = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      pendingStream = stream;
      if (expired.current || !soundAllowed.current || socket.current?.readyState !== WebSocket.OPEN) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const context = new AudioContext({ sampleRate: 16000 });
      pendingContext = context;
      await context.resume();
      if (expired.current || !soundAllowed.current || socket.current?.readyState !== WebSocket.OPEN) {
        stream.getTracks().forEach((track) => track.stop());
        void context.close();
        return;
      }
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const sink = context.createGain();
      sink.gain.value = 0;
      processor.onaudioprocess = (event) => {
        if (socket.current?.readyState !== WebSocket.OPEN) return;
        const input = event.inputBuffer.getChannelData(0);
        const ratio = event.inputBuffer.sampleRate / 16000;
        const pcm = new Int16Array(Math.floor(input.length / ratio));
        for (let i = 0; i < pcm.length; i++) {
          const sample = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)]));
          pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }
        const bytes = new Uint8Array(pcm.buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        socket.current.send(JSON.stringify({ realtimeInput: { audio: { data: btoa(binary), mimeType: "audio/pcm;rate=16000" } } }));
      };
      source.connect(processor);
      processor.connect(sink);
      sink.connect(context.destination);
      mic.current = { stream, context, source, processor, sink };
      setMicrophoneOn(true);
      window.dispatchEvent(new CustomEvent("oracle-microphone", { detail: { active: true } }));
      setStatus("Microfone ligado. Fale sobre sua leitura.");
    } catch {
      pendingStream?.getTracks().forEach((track) => track.stop());
      if (pendingContext) void pendingContext.close();
      setStatus("Não foi possível usar o microfone. Você pode escrever sua pergunta.");
    }
  };

  if (!session.isPaid || !available) return null;
  const scene = sceneAssets(session.persona);

  return (
    <section id={`oracle-live-${session.id}`} className="scroll-mt-6 rounded-2xl border border-cyan-500/40 bg-slate-900/90 p-5 sm:p-6 text-slate-100" aria-labelledby="live-title">
      <div className="relative mb-5 h-[min(27dvh,220px)] min-h-36 overflow-hidden rounded-xl border border-white/10 bg-slate-950" style={{ backgroundImage: `radial-gradient(ellipse at 50% 100%, ${scene.accent}40, transparent 72%)` }}>
        <Image src={scene.close} alt={`Personagem da leitura: ${session.persona}`} fill sizes="(max-width: 640px) 90vw, 700px" quality={80} className="object-contain object-center" />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-linear-to-t from-slate-950 to-transparent px-3 pb-3 pt-8 text-xs">
          <span className="rounded-full bg-slate-950/80 px-3 py-2">{session.persona}</span>
          {(state === "connecting" || state === "ready") && <span className="rounded-full border border-white/20 bg-slate-950/90 px-3 py-2 font-semibold tabular-nums">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</span>}
        </div>
      </div>
      <h3 id="live-title" className="font-serif text-xl text-cyan-200">Converse sobre sua leitura</h3>
      <p className="mt-1 text-sm text-slate-300">Você tem 3 minutos para tirar dúvidas e aprofundar sua leitura. Esta conversa acompanha as cartas que já saíram na sua mesa.</p>
      <p role="status" aria-live="polite" className="mt-3 text-sm text-amber-200">{status}</p>
      {state === "idle" ? (
        <button type="button" onClick={start} className="mt-4 min-h-12 rounded-xl bg-cyan-700 px-5 py-2.5 font-semibold text-white hover:bg-cyan-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">Começar conversa com som</button>
      ) : (
        <>
          {state !== "ended" && <p className="mt-3 text-sm font-semibold text-cyan-200">Tempo restante: {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</p>}
          <div className="mt-4 max-h-64 space-y-3 overflow-y-auto rounded-xl bg-slate-950/70 p-3" role="log" aria-label="Conversa ao vivo">
            {messages.length ? messages.map((message, index) => <p key={index} className="text-sm"><strong className="text-cyan-200">{message.from}: </strong>{message.text}</p>) : <p className="text-sm text-slate-400">A conversa aparecerá aqui.</p>}
          </div>
          {state === "ready" && <>
            <form onSubmit={sendText} className="mt-4 flex gap-2">
              <label htmlFor={`live-text-${session.id}`} className="sr-only">Pergunta sobre a leitura</label>
              <input id={`live-text-${session.id}`} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} placeholder="Pergunte sobre suas cartas" className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" />
              <button type="submit" disabled={!draft.trim()} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">Enviar</button>
            </form>
            <button type="button" onClick={toggleMic} aria-pressed={microphoneOn} className="mt-3 min-h-12 rounded-xl border border-cyan-500/50 px-4 py-2 text-sm hover:bg-slate-800">{microphoneOn ? "Desligar microfone" : "Ligar microfone"}</button>
          </>}
          {state !== "ended" && <button type="button" onClick={() => end("Conversa encerrada por você.")} className="ml-3 mt-3 text-sm text-slate-300 underline">Encerrar</button>}
        </>
      )}
    </section>
  );
}
