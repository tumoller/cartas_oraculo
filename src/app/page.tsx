"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { sceneAssets } from "@/lib/scene-assets";
import {
  Sparkles,
  Compass,
  Heart,
  Briefcase,
  Users,
  Flame,
  Globe2,
  ChevronRight,
  Loader2,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { CosmicBackground } from "@/components/CosmicBackground";
import { ReadingBoard } from "@/components/ReadingBoard";
import { SpreadBoard } from "@/components/SpreadBoard";
import { SPREADS, SpreadId } from "@/lib/spread-config";
import { setSoundPreference } from "@/lib/sound-preference";
import { getReadingFontSize, setReadingFontSize } from "@/lib/reading-font";
import { PersonaType, ThemeType, ReadingSessionPayload } from "@/types";

const PERSONAS: { id: PersonaType; title: string; desc: string; icon: LucideIcon }[] = [
  {
    id: "Oráculo da Galáxia",
    title: "Oráculo da Galáxia",
    desc: "Uma linguagem simbólica inspirada no cosmos.",
    icon: Globe2,
  },
  {
    id: "Cigana Tradicional",
    title: "Cigana Tradicional",
    desc: "Uma leitura simbólica inspirada no imaginário cigano.",
    icon: Flame,
  },
  {
    id: "Linha de Umbanda",
    title: "Linha de Umbanda",
    desc: "Uma linguagem simbólica inspirada na Umbanda, sem atendimento mediúnico.",
    icon: Compass,
  },
];

const THEMES: { id: ThemeType; title: string; desc: string; icon: LucideIcon }[] = [
  {
    id: "Amor & Relacionamento",
    title: "Amor & Relacionamento",
    desc: "Relações, sentimentos e possibilidades de conversa.",
    icon: Heart,
  },
  {
    id: "Trabalho & Dinheiro",
    title: "Trabalho & Dinheiro",
    desc: "Trabalho, dinheiro e escolhas possíveis.",
    icon: Briefcase,
  },
  {
    id: "Amizades & Caminhos",
    title: "Amizades & Caminhos",
    desc: "Amizades, convivência e caminhos a considerar.",
    icon: Users,
  },
];

export default function Home() {
  const [step, setStep] = useState<"form" | "reading">("form");
  const [userName, setUserName] = useState("");
  const [question, setQuestion] = useState("");
  const [spread, setSpread] = useState<SpreadId>("line5");
  const [readingDepth, setReadingDepth] = useState<"basic" | "complete">("basic");
  const [narrationChoice, setNarrationChoice] = useState<boolean | null>(null);
  const [initialNarration, setInitialNarration] = useState<boolean | undefined>();
  const [demoAccess, setDemoAccess] = useState(false);
  const [recent, setRecent] = useState<{id:string;label:string}[]>([]);
  const [requestIdentity, setRequestIdentity] = useState<{requestId:string;requestKey:string} | null>(null);
  const inFlight = useRef(false);
  const [selectedPersona, setSelectedPersona] =
    useState<PersonaType>("Oráculo da Galáxia");
  const [selectedTheme, setSelectedTheme] =
    useState<ThemeType>("Amor & Relacionamento");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<ReadingSessionPayload | null>(
    null
  );
  const activePersona = step === "reading" && sessionData ? sessionData.persona : selectedPersona;
  const sceneTheme = activePersona === "Linha de Umbanda" ? "umbanda" : activePersona === "Cigana Tradicional" ? "cigano" : "cosmico";

  useEffect(() => {
    document.documentElement.dataset.oraclePersona = sceneTheme;
    return () => { delete document.documentElement.dataset.oraclePersona; };
  }, [sceneTheme]);

  useEffect(() => {
    setReadingFontSize(getReadingFontSize());
    let active = true;
    queueMicrotask(() => {
    if (!active) return;
    try {
      const saved = JSON.parse(localStorage.getItem("oracle_recent") || "[]");
      if (Array.isArray(saved)) setRecent(saved.filter((item) => typeof item?.id === "string" && typeof item?.label === "string").slice(0, 20));
      const pending = JSON.parse(localStorage.getItem("oracle_pending") || "null");
      if (typeof pending?.identity?.requestId === "string" && typeof pending?.identity?.requestKey === "string" && Object.hasOwn(SPREADS,pending.spread) && PERSONAS.some((item) => item.id === pending.persona) && THEMES.some((item) => item.id === pending.theme)) {
        setRequestIdentity(pending.identity);
        setUserName(pending.userName || ""); setQuestion(pending.question || "");
        setSelectedPersona(pending.persona); setSelectedTheme(pending.theme);
        setSpread(pending.spread || "line5"); setDemoAccess(Boolean(pending.demoAccess));
        setReadingDepth(pending.readingDepth === "basic" ? "basic" : "complete");
      }
    } catch { /* navegador sem armazenamento: a consulta atual continua funcional */ }
    });
    return () => { active = false; };
  }, []);

  const openSaved = async (id: string) => {
    setLoadingSaved(true);
    setIsLoading(true); setErrorMessage(null);
    try {
      const response = await fetch(`/api/reading/${id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível abrir a consulta.");
      setInitialNarration(undefined); setSessionData(data); setStep("reading"); window.scrollTo({top:0});
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Não foi possível abrir a consulta."); }
    finally { setIsLoading(false); }
  };

  const handleStartReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    if (!userName.trim()) {
      setErrorMessage("Por favor, digite o seu primeiro nome.");
      return;
    }
    if (narrationChoice === null) {
      setErrorMessage("Escolha se deseja começar com som ou sem som.");
      return;
    }

    setErrorMessage(null);
    setLoadingSaved(false);
    setIsLoading(true);
    inFlight.current = true;

    try {
      // randomUUID exige contexto seguro; a rede local HTTP usa os mesmos bytes criptográficos.
      const uuid = () => typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (character) => (Number(character) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(character) / 4).toString(16));
      const identity = requestIdentity || { requestId: uuid(), requestKey: uuid() };
      setRequestIdentity(identity);
      const depth = spread === "box9" || spread === "grand36" ? readingDepth : "complete";
      try { localStorage.setItem("oracle_pending", JSON.stringify({identity,userName,question,persona:selectedPersona,theme:selectedTheme,spread,readingDepth:depth,demoAccess})); } catch {}
      const response = await fetch("/api/reading/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: userName.trim(),
          persona: selectedPersona,
          theme: selectedTheme,
          question: question.trim(),
          spread, readingDepth: depth, demoAccess, ...identity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao consultar o oráculo.");
      }

      setInitialNarration(narrationChoice);
      setSessionData(data);
      const updated = [{id:data.id,label:`${data.userName} · ${SPREADS[data.spread as SpreadId || "line5"].title}`}, ...recent.filter((item) => item.id !== data.id)].slice(0,20);
      setRecent(updated); setRequestIdentity(null);
      try { localStorage.setItem("oracle_recent",JSON.stringify(updated)); localStorage.removeItem("oracle_pending"); } catch {}
      setStep("reading");
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (err) {
      console.error("Falha ao iniciar leitura:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Erro de conexão com o oráculo. Tente novamente."
      );
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSessionData(null);
    setInitialNarration(undefined);
    setNarrationChoice(null);
    setStep("form");
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  return (
    <main data-oracle-persona={sceneTheme} className={`min-h-screen min-w-0 relative flex flex-col items-center justify-center ${step === "reading" ? "p-2 sm:p-4" : "p-4 sm:p-6 lg:p-8"}`}>
      {sceneTheme === "cosmico" && <CosmicBackground />}

      {step === "reading" && sessionData ? (
        sessionData.sections ? <SpreadBoard key={sessionData.id} session={sessionData} onReset={handleReset} initialNarration={initialNarration} /> : <ReadingBoard key={sessionData.id} initialSession={sessionData} onReset={handleReset} initialNarration={initialNarration} />
      ) : (
        /* FORMULÁRIO DE ENTRADA (PASSO 1) */
        <div ref={(element) => { if (element) element.inert = isLoading; }} className="w-full min-w-0 max-w-2xl bg-slate-900/80 border border-slate-800 rounded-3xl p-4 sm:p-10 shadow-2xl backdrop-blur-md cosmic-card-glow my-8">
          {/* Cabeçalho do App */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-900/40 border border-purple-400/30 text-purple-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Baralho Cigano & Oráculo Universal
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 font-serif tracking-tight">
              Tiragem de Cartas Oraculares
            </h1>
            <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
              Faça uma pergunta ou escolha um tema para explorar as cartas como
              reflexão simbólica.
            </p>
          </div>

          <form onSubmit={handleStartReading} className="w-full min-w-0 space-y-6">
            {recent.length > 0 && <details className="rounded-xl border border-slate-700 p-4 text-sm"><summary className="cursor-pointer text-amber-200">Minhas leituras neste navegador</summary><p className="text-xs text-slate-400 mt-2">Você pode reabrir estas leituras por até 30 dias neste mesmo navegador.</p><div className="mt-3 space-y-2">{recent.map((item) => <button key={item.id} type="button" disabled={isLoading} onClick={() => openSaved(item.id)} className="block text-left underline underline-offset-4 text-slate-200 py-2">{item.label}</button>)}</div></details>}
            {requestIdentity && <div className="rounded-xl border border-amber-500/30 p-4 text-sm text-amber-100">Sua leitura ainda está sendo preparada. Se tentar novamente, as mesmas cartas serão usadas.<button type="button" disabled={isLoading} onClick={() => { setRequestIdentity(null); try { localStorage.removeItem("oracle_pending"); } catch {} }} className="block mt-3 text-xs underline disabled:opacity-40">Começar outra leitura</button></div>}
            {/* Campo 1: Primeiro Nome */}
            <fieldset disabled={Boolean(requestIdentity)} className="min-w-0 space-y-6 disabled:opacity-70">
            <div>
              <label
                htmlFor="userName"
                className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2"
              >
                1. Digite seu Primeiro Nome:
              </label>
              <input
                id="userName"
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Ex: Mariana, Carlos, Helena..."
                maxLength={40}
                required
                className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-medium text-sm"
              />
            </div>

            {/* Campo 2: Escolha da Persona */}
            <fieldset className="min-w-0">
              <legend className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                2. Escolha o estilo da leitura:
              </legend>
              <div className="flex w-full min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3 sm:grid sm:grid-cols-3 sm:overflow-visible" aria-label="Personagens disponíveis">
                {PERSONAS.map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedPersona === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedPersona(item.id)}
                      aria-pressed={isSelected}
                      className={`w-[78%] shrink-0 snap-center overflow-hidden rounded-2xl border cursor-pointer transition-colors flex flex-col text-left sm:w-auto ${
                        isSelected
                          ? "bg-purple-950/60 border-purple-500 shadow-md shadow-purple-500/20"
                          : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950"
                      }`}
                    >
                      <div className="relative h-72 w-full bg-slate-950 sm:h-56" style={{ backgroundImage: `radial-gradient(ellipse at bottom, ${sceneAssets(item.id).accent}30, transparent 70%)` }}>
                        <Image src={sceneAssets(item.id).portrait} alt={item.title} fill sizes="(max-width: 640px) 65vw, 200px" className="object-contain object-bottom" quality={80} />
                        {isSelected && <span className="absolute bottom-2 left-2 rounded-full border border-amber-300/50 bg-slate-950/90 px-3 py-1 text-xs text-amber-200">Selecionada</span>}
                      </div>
                      <div className="p-3.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon
                          className={`w-4 h-4 ${
                            isSelected ? "text-amber-400" : "text-slate-400"
                          }`}
                        />
                        <span
                          className={`text-xs font-bold ${
                            isSelected ? "text-white" : "text-slate-300"
                          }`}
                        >
                          {item.title}
                        </span>
                      </div>
                      <span className="text-sm text-slate-400 leading-tight">
                        {item.desc}
                      </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Campo 3: Tema da Leitura */}
            <fieldset className="min-w-0">
              <legend className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                3. Escolha o tema:
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {THEMES.map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedTheme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedTheme(item.id)}
                      aria-pressed={isSelected}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between text-left ${
                        isSelected
                          ? "bg-indigo-950/60 border-indigo-500 shadow-md shadow-indigo-500/20"
                          : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon
                          className={`w-4 h-4 ${
                            isSelected ? "text-cyan-400" : "text-slate-400"
                          }`}
                        />
                        <span
                          className={`text-xs font-bold ${
                            isSelected ? "text-white" : "text-slate-300"
                          }`}
                        >
                          {item.title}
                        </span>
                      </div>
                      <span className="text-sm text-slate-400 leading-tight">
                        {item.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="question" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                4. Sua pergunta (opcional):
              </label>
              <textarea
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="O que você gostaria de refletir sobre este tema?"
                className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm"
              />
            </div>

            <details className="text-sm text-slate-400">
              <summary className="cursor-pointer text-slate-300">Preparar a leitura (opcional)</summary>
              <p className="mt-2">Se quiser, respire com calma e pense no que deseja compreender. Você pode seguir sem fazer isso; a leitura é simbólica e não promete prever acontecimentos.</p>
            </details>
            </fieldset>

            <fieldset className="min-w-0"><legend className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Escolha quantas cartas abrir</legend><div className="grid grid-cols-2 gap-2">{Object.entries(SPREADS).map(([id,item]) => <button key={id} type="button" disabled={Boolean(requestIdentity)} aria-pressed={spread === id} onClick={() => { setSpread(id as SpreadId); setDemoAccess(false); }} className={`min-w-0 p-3 rounded-xl border text-left text-sm ${spread === id ? "border-amber-400 bg-amber-950/40 text-amber-100" : "border-slate-700 bg-slate-950 text-slate-300"}`}>{item.title}</button>)}</div></fieldset>
            {(spread === "box9" || spread === "grand36") ? <fieldset disabled={Boolean(requestIdentity)} className="min-w-0 disabled:opacity-70">
              <legend className="mb-2 text-sm font-bold text-slate-200">Profundidade da leitura</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" aria-pressed={readingDepth === "basic"} onClick={() => setReadingDepth("basic")} className={`min-h-12 rounded-xl border p-3 text-left text-sm ${readingDepth === "basic" ? "border-amber-300 bg-amber-950/50 text-amber-100" : "border-slate-700 text-slate-200"}`}><strong className="block">Básico</strong><span>Leitura das linhas e síntese geral.</span></button>
                <button type="button" aria-pressed={readingDepth === "complete"} onClick={() => setReadingDepth("complete")} className={`min-h-12 rounded-xl border p-3 text-left text-sm ${readingDepth === "complete" ? "border-amber-300 bg-amber-950/50 text-amber-100" : "border-slate-700 text-slate-200"}`}><strong className="block">Completo</strong><span>{spread === "box9" ? "Linhas, colunas, centro, diagonais e síntese." : "Linhas, vizinhança do tema, quatro cantos e síntese."}</span></button>
              </div>
            </fieldset> : <p className="text-sm text-slate-300">Centro e combinações integrados à leitura da linha.</p>}
            {spread !== "line5" && <label className="flex gap-3 text-sm text-slate-300 rounded-xl p-4 bg-indigo-950/40 border border-indigo-500/30"><input type="checkbox" checked={demoAccess} disabled={Boolean(requestIdentity)} onChange={(event) => setDemoAccess(event.target.checked)} required className="mt-1" /><span>Quero ver a leitura completa nesta demonstração. Não há cobrança.</span></label>}

            <fieldset className="min-w-0">
              <legend className="block text-sm font-bold text-slate-200 mb-2">Gostaria de ouvir a leitura?</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Som da consulta">
                <button type="button" aria-pressed={narrationChoice === true} onClick={() => { setNarrationChoice(true); setSoundPreference(true); }} className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-medium ${narrationChoice === true ? "border-amber-300 bg-amber-950/50 text-amber-100" : "border-slate-700 bg-slate-950 text-slate-200"}`}>Sim, ouvir a leitura</button>
                <button type="button" aria-pressed={narrationChoice === false} onClick={() => { setNarrationChoice(false); setSoundPreference(false); }} className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-medium ${narrationChoice === false ? "border-amber-300 bg-amber-950/50 text-amber-100" : "border-slate-700 bg-slate-950 text-slate-200"}`}>Seguir sem som</button>
              </div>
              <p className="mt-2 text-sm text-slate-400">Com som, a narração é preparada enquanto você abre as cartas e começa quando a parte estiver revelada. Você pode mudar sua escolha durante a leitura.</p>
            </fieldset>
            <p className="text-sm leading-relaxed text-slate-400">Esta é uma interpretação digital baseada nos símbolos e métodos do Petit Lenormand, o baralho cigano. Receba a leitura de acordo com sua fé e intenção: ela não é uma verdade absoluta nem substitui uma consulta presencial. Nenhuma leitura, digital ou presencial, determina seu futuro ou suas decisões.</p>

            {/* Feedback de Erro */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Botão de Ação */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-6 rounded-xl bg-linear-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-sm sm:text-base tracking-wide transition-all shadow-xl shadow-purple-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  <span>Preparando sua consulta…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  <span>{requestIdentity ? "Concluir a mesma consulta" : `Abrir minha mesa · ${SPREADS[spread].count} cartas`}</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Rodapé sutil de segurança */}
          <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-sm text-slate-500">
            <span>Sorteio de {SPREADS[spread].count} cartas</span>
            <Link href="/como-funciona" className="underline underline-offset-4 hover:text-slate-300">Como funciona</Link>
          </div>
        </div>
      )}
      {isLoading && <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-5 backdrop-blur-md">
        <div className="flex w-full max-w-sm flex-col items-center text-center">
          <div className="consultation-preparing-portrait relative h-[min(52dvh,360px)] w-full">
            <Image src={sceneAssets(selectedPersona).portrait} alt="" fill sizes="(max-width: 640px) 90vw, 384px" className="object-contain object-bottom" priority />
          </div>
          <h2 className="mt-5 font-serif text-2xl text-amber-100">{loadingSaved ? "Abrindo sua leitura" : "Preparando sua mesa"}</h2>
          <p className="mt-3 text-base leading-relaxed text-slate-200">{loadingSaved ? "Buscando a leitura que você já começou." : "Sua leitura está sendo preparada. Em instantes, você poderá abrir as cartas no seu ritmo."}</p>
        </div>
      </div>}
    </main>
  );
}

