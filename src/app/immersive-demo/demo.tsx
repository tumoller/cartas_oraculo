"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { sceneAssets } from "@/lib/scene-assets";
import { OraclePortrait } from "@/components/OraclePortrait";
import styles from "./demo.module.css";

const personas = ["Oráculo da Galáxia", "Cigana Tradicional", "Linha de Umbanda"];
const passages = [
  "As cartas mostram um momento de movimento, mas também de escolhas que pedem atenção.",
  "Há algo se aproximando do seu caminho. Antes de responder à pressa, observe o que já está diante de você.",
  "Nem tudo precisa ser decidido agora. Uma conversa clara pode ajudar a perceber o que faz sentido seguir.",
  "Leve desta leitura uma pergunta: o que você precisa enxergar com mais calma antes de dar o próximo passo?",
];
type Phase = "choice" | "preparing" | "speaking" | "finished";

export default function Demo() {
  const [persona, setPersona] = useState(personas[0]);
  const [phase, setPhase] = useState<Phase>("choice");
  const [preparation, setPreparation] = useState<"table" | "concentrating">("table");
  const [audioMode, setAudioMode] = useState(false);
  const [immersive, setImmersive] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [showText, setShowText] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const art = sceneAssets(persona);
  const audioFile = persona === personas[1] ? "cigano" : persona === personas[2] ? "umbanda" : "cosmico";

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function start(withAudio: boolean) {
    setAudioMode(withAudio); setShowText(false); setError(""); setPreparation("table"); setPhase("preparing");
    timer.current = setTimeout(() => {
      setPreparation("concentrating");
      timer.current = setTimeout(() => {
        setPhase("speaking");
        if (withAudio) audio.current?.play().then(() => setPlaying(true)).catch(() => setError("Toque em Reproduzir para iniciar o áudio de demonstração."));
      }, 1800);
    }, 1500);
  }
  function toggleAudio() {
    if (!audio.current) return;
    if (audio.current.ended) audio.current.currentTime = 0;
    if (audio.current.paused) audio.current.play().then(() => { setPlaying(true); setError(""); }).catch(() => setError("Não foi possível reproduzir o áudio neste navegador."));
    else { audio.current.pause(); setPlaying(false); }
  }
  function leave() {
    setImmersive(false);
    try { if (!sessionStorage.getItem("immersive-demo-seen")) { setOnboarding(true); sessionStorage.setItem("immersive-demo-seen", "1"); } } catch { setOnboarding(true); }
  }
  function reset() {
    if (timer.current) clearTimeout(timer.current);
    audio.current?.pause(); if (audio.current) audio.current.currentTime = 0;
    setPlaying(false); setPhase("choice"); setImmersive(true); setOnboarding(false);
  }
  return <main className={styles.shell}>
    <audio ref={audio} src={`/audio/welcome-${audioFile}.wav`} preload="metadata" onEnded={() => { setPlaying(false); setPhase("finished"); }} onError={() => setError("Áudio indisponível. Experimente a leitura em texto.")} />
    <div className={styles.frame}>
      <header className={styles.header}><span>✦ CARTAS ORÁCULO</span><span className={styles.badge}>DEMONSTRAÇÃO LOCAL</span></header>
      {phase === "choice" ? <section className={styles.intro}>
        <p className={styles.eyebrow}>UM INSTANTE PARA VOCÊ</p><h1>Entre na sua<br /><em>leitura</em></h1>
        <p>Escolha quem vai conduzir este momento. Esta é uma demonstração visual com texto de exemplo.</p>
        <div className={styles.choices} aria-label="Escolha uma personagem">{personas.map((name) => <button key={name} type="button" aria-pressed={persona === name} className={`${styles.choice} ${persona === name ? styles.selected : ""}`} onClick={() => setPersona(name)}><Image src={sceneAssets(name).close} alt="" width={90} height={90} /><span>{name}</span></button>)}</div>
        <p className={styles.small}>Como prefere acompanhar?</p><div className={styles.actions}><button className={styles.primary} onClick={() => start(true)}>Ouvir demonstração <span>↗</span></button><button className={styles.secondary} onClick={() => start(false)}>Somente texto</button></div>
        <p className={styles.disclaimer}>O áudio é uma breve amostra de voz e não narra o texto exibido.</p>
      </section> : immersive ? <section className={styles.experience}>
        <div className={styles.visual}>
          <OraclePortrait persona={persona} preparing={phase === "preparing"} playing={playing} />
          <div className={styles.visualTop}><span>✦ {phase === "preparing" ? "PREPARANDO A MESA" : "SUA LEITURA"}</span></div>
          <div className={styles.visualBottom}><span>{phase === "preparing" ? preparation === "table" ? "A mesa se abre" : "Concentrando" : "A leitura começa"}</span><small>Imagens existentes · poses ilustrativas provisórias</small></div>
        </div>
        <div className={styles.demoCards} aria-label="Cartas ilustrativas da demonstração"><span>EXEMPLO · CARTAS ILUSTRATIVAS</span>{[1, 9, 24].map((card) => <Image key={card} src={`/cards/cosmico/card-${card}.jpg`} alt="" width={65} height={100} />)}</div>
        <div className={styles.reading}>
          <div className={styles.readingTop}><span>✦ {persona}</span><span>{phase === "preparing" ? "PREPARAÇÃO" : "LEITURA"}</span></div>
          {phase === "preparing" ? <><h2>Um instante de calma.</h2><p>Estamos preparando a mesa e abrindo espaço para a sua leitura.</p></> : <><p className={styles.caption}>{audioMode ? "Amostra breve de voz; não narra o texto abaixo." : "Leitura de exemplo · acompanhe no seu ritmo"}</p><button className={styles.textToggle} aria-expanded={showText} aria-controls="demo-text" onClick={() => setShowText(!showText)}>{showText ? "Ocultar texto" : "Acompanhar o texto desta leitura"}</button>{showText && <div id="demo-text" className={styles.fullText} tabIndex={0} aria-label="Texto completo da leitura de exemplo">{passages.map((passage) => <p key={passage}>{passage}</p>)}</div>}</>}
          {error && <p role="status" className={styles.error}>{error}</p>}
          <div className={styles.readingControls}>{audioMode && phase !== "preparing" && <button className={styles.primary} onClick={toggleAudio}>{playing ? "Ⅱ  Pausar" : "▶  Reproduzir"}</button>}<button className={styles.secondary} onClick={leave}>Sair da imersão ↗</button>{phase === "finished" && <button className={styles.secondary} onClick={reset}>Recomeçar</button>}</div>
        </div>
      </section> : <section className={styles.outside}><p className={styles.eyebrow}>SUA CONSULTA</p><h1>Seu espaço,<br /><em>seu tempo.</em></h1><p>A leitura continua disponível enquanto você explora este espaço de demonstração.</p><div className={styles.placeholder}><span>✦</span><h2>As cartas da sua mesa</h2><p>Esta área representa o restante da consulta.</p></div><button className={styles.secondary} onClick={reset}>Escolher outra personagem</button></section>}
    </div>
    {!immersive && phase !== "choice" && <div className={styles.dockWrap}>{onboarding && <div className={styles.tip} role="status"><button aria-label="Fechar dica" onClick={() => setOnboarding(false)}>×</button><strong>Sua leitura continua aqui</strong><p>Toque na personagem para voltar à imersão ou controlar o áudio.</p></div>}<div className={styles.dock}><button className={styles.avatar} onClick={() => { setImmersive(true); setOnboarding(false); }} aria-label="Voltar à leitura imersiva"><Image src={art.close} alt="" width={64} height={64} /></button><div><strong>{persona}</strong><small>{phase === "preparing" ? "Preparando leitura" : playing ? "Áudio em reprodução" : "Sua leitura"}</small></div>{audioMode && phase !== "preparing" && <button className={styles.dockControl} onClick={toggleAudio} aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"}>{playing ? "Ⅱ" : "▶"}</button>}</div></div>}
  </main>;
}

