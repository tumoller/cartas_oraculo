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
import { formatBRL, PRICES, type PricedSpread } from "@/lib/pricing";
import { PaymentModal } from "@/components/PaymentModal";
import { setSoundPreference, useSoundPreference } from "@/lib/sound-preference";
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
  const soundPref = useSoundPreference();
  const [step, setStep] = useState<"form" | "reading">("form");
  const [userName, setUserName] = useState("");
  const [question, setQuestion] = useState("");
  const [spread, setSpread] = useState<SpreadId>("line5");
  const [readingDepth, setReadingDepth] = useState<"basic" | "complete">("basic");
  const [narrationChoice, setNarrationChoice] = useState<boolean | null>(null);
  const [initialNarration, setInitialNarration] = useState<boolean | undefined>();
  const [demoAccess, setDemoAccess] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  // Pix já confirmado desta consulta: uma nova tentativa (ex.: IA falhou) não cobra de novo.
  const [paidPaymentId, setPaidPaymentId] = useState<string | null>(null);
  const [recent, setRecent] = useState<{id:string;label:string}[]>([]);
  const [requestIdentity, setRequestIdentity] = useState<{requestId:string;requestKey:string} | null>(null);
  const inFlight = useRef(false);
  const [selectedPersona, setSelectedPersona] =
    useState<PersonaType>("Oráculo da Galáxia");
  const [selectedTheme, setSelectedTheme] =
    useState<ThemeType>("Amor & Relacionamento");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<"opening" | "concentrating" | "awakening">("opening");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<ReadingSessionPayload | null>(
    null
  );
  const activePersona = step === "reading" && sessionData ? sessionData.persona : selectedPersona;
  const sceneTheme = activePersona === "Linha de Umbanda" ? "umbanda" : activePersona === "Cigana Tradicional" ? "cigano" : "cosmico";

  useEffect(() => {
    if (narrationChoice === null && soundPref !== null) {
      // Restore saved sound choice on form hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNarrationChoice(soundPref);
    }
  }, [narrationChoice, soundPref]);

  useEffect(() => {
    document.documentElement.dataset.oraclePersona = sceneTheme;
    return () => { delete document.documentElement.dataset.oraclePersona; };
  }, [sceneTheme]);

  // Transição de concentração durante o carregamento: olhos abertos -> olhos fechados (concentrando)
  useEffect(() => {
    if (!isLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingPhase("opening");
    const timer = window.setTimeout(() => {
      setLoadingPhase((curr) => (curr === "opening" ? "concentrating" : curr));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

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
        if (typeof pending.paymentId === "string") setPaidPaymentId(pending.paymentId);
        // Voltou do app do banco com um Pix em andamento: reabre o pagamento, que retoma o status.
        else if (pending.spread !== "line5" && localStorage.getItem(`oracle_payment_${pending.identity.requestId}`)) setPayOpen(true);
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
      setLoadingPhase("awakening");
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      setInitialNarration(narrationChoice ?? soundPref ?? undefined);
      setSessionData(data);
      setStep("reading");
      window.scrollTo({top:0});
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Não foi possível abrir a consulta."); }
    finally { setIsLoading(false); }
  };

  // Volta da página da InfinitePay (/?pagamento=id): leitura de 5 cartas reabre com o pagamento na tela.
  // A mesa de 9/36 é retomada pelo oracle_pending acima.
  useEffect(() => {
    const returned = new URLSearchParams(window.location.search).get("pagamento");
    if (!returned) return;
    window.history.replaceState(null, "", window.location.pathname);
    fetch(`/api/payment/${encodeURIComponent(returned)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payment) => { if (payment?.kind === "unlock" && typeof payment.readingId === "string") void openSaved(payment.readingId); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartReading = (e: React.FormEvent) => {
    e.preventDefault();
    void startReading();
  };

  const startReading = async (newPaidId?: string) => {
    if (inFlight.current) return;
    const paidId = newPaidId ?? paidPaymentId ?? undefined;
    if (!userName.trim()) {
      setErrorMessage("Por favor, digite o seu primeiro nome.");
      return;
    }
    const effectiveNarration = narrationChoice ?? soundPref;
    if (effectiveNarration === null) {
      setErrorMessage("Escolha se deseja começar com som ou sem som.");
      return;
    }

    setErrorMessage(null);
    // randomUUID exige contexto seguro; a rede local HTTP usa os mesmos bytes criptográficos.
    const uuid = () => typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (character) => (Number(character) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(character) / 4).toString(16));
    const identity = requestIdentity || { requestId: uuid(), requestKey: uuid() };
    setRequestIdentity(identity);
    const depth = spread === "box9" || spread === "grand36" ? readingDepth : "complete";
    try { localStorage.setItem("oracle_pending", JSON.stringify({identity,userName,question,persona:selectedPersona,theme:selectedTheme,spread,readingDepth:depth,demoAccess,paymentId:paidId})); } catch {}
    if (newPaidId) setPaidPaymentId(newPaidId);
    // 9 e 36 cartas: paga antes do sorteio (a IA só roda depois do Pix confirmado).
    if (spread !== "line5" && !demoAccess && !paidId) {
      setPayOpen(true);
      return;
    }

    setLoadingSaved(false);
    setIsLoading(true);
    inFlight.current = true;

    try {
      const response = await fetch("/api/reading/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: userName.trim(),
          persona: selectedPersona,
          theme: selectedTheme,
          question: question.trim(),
          spread, readingDepth: depth, demoAccess, paymentId: paidId, ...identity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao consultar o oráculo.");
      }

      // Abre os olhos por um breve instante antes de abrir a mesa
      setLoadingPhase("awakening");
      await new Promise((resolve) => window.setTimeout(resolve, 650));

      setInitialNarration(effectiveNarration);
      setSessionData(data);
      const updated = [{id:data.id,label:`${data.userName} · ${SPREADS[data.spread as SpreadId || "line5"].title}`}, ...recent.filter((item) => item.id !== data.id)].slice(0,20);
      setRecent(updated); setRequestIdentity(null); setPaidPaymentId(null);
      try { localStorage.setItem("oracle_recent",JSON.stringify(updated)); localStorage.removeItem("oracle_pending"); localStorage.removeItem(`oracle_payment_${identity.requestId}`); } catch {}
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
    setStep("form");
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const loadingAssets = sceneAssets(selectedPersona);

  return (
    <main
      data-oracle-persona={sceneTheme}
      className={`min-h-screen w-full min-w-0 relative flex flex-col ${
        step === "reading"
          ? "items-stretch justify-start p-0"
          : "items-center justify-center p-4 sm:p-6 lg:p-8"
      }`}
    >
      {sceneTheme === "cosmico" && <CosmicBackground />}

      {step === "reading" && sessionData ? (
        sessionData.sections ? (
          <SpreadBoard key={sessionData.id} session={sessionData} onReset={handleReset} initialNarration={initialNarration} />
        ) : (
          <ReadingBoard key={sessionData.id} initialSession={sessionData} onReset={handleReset} initialNarration={initialNarration} />
        )
      ) : (
        /* FORMULÁRIO DE ENTRADA (PASSO 1) — Expandido em 2 colunas no Desktop */
        <div
          ref={(element) => {
            if (element) element.inert = isLoading;
          }}
          className="w-full min-w-0 max-w-2xl lg:max-w-5xl xl:max-w-6xl bg-slate-900/85 border border-slate-800 rounded-3xl p-4 sm:p-8 lg:p-10 shadow-2xl backdrop-blur-md cosmic-card-glow my-4 lg:my-6"
        >
          {/* Cabeçalho do App */}
          <div className="text-center mb-6 lg:mb-8">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-purple-900/40 border border-purple-400/30 text-purple-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Baralho Cigano & Oráculo Universal
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 font-serif tracking-tight">
              Tiragem de Cartas Oraculares
            </h1>
            <p className="text-sm sm:text-base text-slate-400 mt-2 max-w-xl mx-auto">
              Faça uma pergunta ou escolha um tema para explorar as cartas como reflexão simbólica.
            </p>
          </div>

          <form onSubmit={handleStartReading} className="w-full min-w-0 space-y-6">
            {recent.length > 0 && (
              <details className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4 text-sm">
                <summary className="cursor-pointer font-medium text-amber-200">
                  Minhas leituras neste navegador ({recent.length})
                </summary>
                <p className="text-xs text-slate-400 mt-1.5">
                  Você pode reabrir estas leituras por até 30 dias neste mesmo navegador.
                </p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {recent.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={isLoading}
                      onClick={() => openSaved(item.id)}
                      className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left text-xs text-slate-200 hover:border-amber-400/50 hover:text-amber-100 transition-colors truncate cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </details>
            )}

            {requestIdentity && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-100 flex flex-wrap items-center justify-between gap-3">
                <span>{paidPaymentId
                  ? "Pagamento confirmado. Toque em “Concluir a mesma consulta” para abrir a sua mesa."
                  : spread !== "line5" && !demoAccess
                  ? "Sua consulta está guardada. Conclua o pagamento para abrir a mesa."
                  : "Sua leitura ainda está sendo preparada. Se tentar novamente, as mesmas cartas serão usadas."}</span>
                {!paidPaymentId && <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setRequestIdentity(null);
                    try {
                      localStorage.removeItem("oracle_pending");
                    } catch {}
                  }}
                  className="text-xs underline disabled:opacity-40 shrink-0"
                >
                  Começar outra leitura
                </button>}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
              {/* COLUNA ESQUERDA NO DESKTOP: Nome, Estilo da Leitura e Tema */}
              <fieldset disabled={Boolean(requestIdentity)} className="min-w-0 space-y-6 disabled:opacity-70 lg:col-span-7">
                {/* Campo 1: Primeiro Nome */}
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
                  <div
                    className="flex w-full min-w-0 snap-x snap-mandatory gap-3.5 overflow-x-auto overscroll-x-contain pb-3 sm:grid sm:grid-cols-3 sm:overflow-visible"
                    aria-label="Personagens disponíveis"
                  >
                    {PERSONAS.map((item) => {
                      const Icon = item.icon;
                      const isSelected = selectedPersona === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedPersona(item.id)}
                          aria-pressed={isSelected}
                          className={`w-[78%] shrink-0 snap-center overflow-hidden rounded-2xl border cursor-pointer transition-all flex flex-col text-left sm:w-auto ${
                            isSelected
                              ? "bg-purple-950/60 border-purple-400 shadow-lg shadow-purple-500/25 ring-1 ring-purple-400/40"
                              : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950"
                          }`}
                        >
                          <div
                            className="relative h-72 w-full bg-slate-950 sm:h-60 lg:h-64"
                            style={{
                              backgroundImage: `radial-gradient(ellipse at bottom, ${sceneAssets(item.id).accent}35, transparent 70%)`,
                            }}
                          >
                            <Image
                              src={sceneAssets(item.id).portrait}
                              alt={item.title}
                              fill
                              sizes="(max-width: 640px) 65vw, 240px"
                              className="object-contain object-bottom"
                            />
                            {isSelected && (
                              <span className="absolute bottom-2 left-2 rounded-full border border-amber-300/60 bg-slate-950/90 px-3 py-1 text-xs font-medium text-amber-200">
                                Selecionada
                              </span>
                            )}
                          </div>
                          <div className="p-3.5 flex-1 flex flex-col">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Icon className={`w-4 h-4 shrink-0 ${isSelected ? "text-amber-400" : "text-slate-400"}`} />
                              <span className={`text-xs font-bold ${isSelected ? "text-white" : "text-slate-300"}`}>
                                {item.title}
                              </span>
                            </div>
                            <span className="text-xs sm:text-sm text-slate-400 leading-snug">{item.desc}</span>
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
                              ? "bg-indigo-950/60 border-indigo-400 shadow-md shadow-indigo-500/20"
                              : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <Icon className={`w-4 h-4 shrink-0 ${isSelected ? "text-cyan-400" : "text-slate-400"}`} />
                            <span className={`text-xs font-bold ${isSelected ? "text-white" : "text-slate-300"}`}>
                              {item.title}
                            </span>
                          </div>
                          <span className="text-xs sm:text-sm text-slate-400 leading-snug">{item.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </fieldset>

              {/* COLUNA DIREITA NO DESKTOP: Pergunta, Quantidade de Cartas, Profundidade, Som e Botão */}
              <div className="min-w-0 space-y-5 lg:col-span-5 lg:rounded-2xl lg:border lg:border-slate-800/90 lg:bg-slate-950/45 lg:p-6">
                <fieldset disabled={Boolean(requestIdentity)} className="min-w-0 space-y-4 disabled:opacity-70">
                  <div>
                    <label
                      htmlFor="question"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2"
                    >
                      4. Sua pergunta (opcional):
                    </label>
                    <textarea
                      id="question"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder="O que você gostaria de refletir sobre este tema?"
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm"
                    />
                  </div>

                  <details className="text-xs sm:text-sm text-slate-400">
                    <summary className="cursor-pointer text-slate-300">Preparar a leitura (opcional)</summary>
                    <p className="mt-1.5">
                      Se quiser, respire com calma e pense no que deseja compreender. Você pode seguir sem fazer isso; a
                      leitura é simbólica e não promete prever acontecimentos.
                    </p>
                  </details>
                </fieldset>

                <fieldset className="min-w-0">
                  <legend className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    5. Escolha quantas cartas abrir:
                  </legend>
                  <div className="grid grid-cols-2 gap-2.5">
                    {Object.entries(SPREADS).map(([id, item]) => (
                      <button
                        key={id}
                        type="button"
                        disabled={Boolean(requestIdentity)}
                        aria-pressed={spread === id}
                        onClick={() => {
                          setSpread(id as SpreadId);
                          setDemoAccess(false);
                        }}
                        className={`min-w-0 p-3 rounded-xl border text-left text-sm transition-colors cursor-pointer ${
                          spread === id
                            ? "border-amber-400 bg-amber-950/45 text-amber-100 font-semibold"
                            : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        {item.title}
                        <span className="block text-xs font-normal text-amber-300/80 mt-0.5">{formatBRL(PRICES[id as PricedSpread])}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                {spread === "box9" || spread === "grand36" ? (
                  <fieldset disabled={Boolean(requestIdentity)} className="min-w-0 disabled:opacity-70">
                    <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                      Profundidade da leitura:
                    </legend>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <button
                        type="button"
                        aria-pressed={readingDepth === "basic"}
                        onClick={() => setReadingDepth("basic")}
                        className={`min-h-12 rounded-xl border p-3 text-left text-xs sm:text-sm cursor-pointer ${
                          readingDepth === "basic"
                            ? "border-amber-300 bg-amber-950/50 text-amber-100"
                            : "border-slate-700 bg-slate-950 text-slate-200"
                        }`}
                      >
                        <strong className="block">Básico</strong>
                        <span className="text-xs opacity-90">Leitura das linhas e síntese geral.</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={readingDepth === "complete"}
                        onClick={() => setReadingDepth("complete")}
                        className={`min-h-12 rounded-xl border p-3 text-left text-xs sm:text-sm cursor-pointer ${
                          readingDepth === "complete"
                            ? "border-amber-300 bg-amber-950/50 text-amber-100"
                            : "border-slate-700 bg-slate-950 text-slate-200"
                        }`}
                      >
                        <strong className="block">Completo</strong>
                        <span className="text-xs opacity-90">
                          {spread === "box9"
                            ? "Linhas, colunas, centro, diagonais e síntese."
                            : "Linhas, vizinhança do tema, quatro cantos e síntese."}
                        </span>
                      </button>
                    </div>
                  </fieldset>
                ) : (
                  <p className="text-xs sm:text-sm text-slate-300">Centro e combinações integrados à leitura da linha.</p>
                )}

                <p className="text-xs sm:text-sm text-slate-300 rounded-xl p-3.5 bg-indigo-950/40 border border-indigo-500/30">
                  {spread === "line5"
                    ? `As 3 primeiras cartas são grátis. A leitura completa custa ${formatBRL(PRICES.line5)} (Pix ou cartão).`
                    : `Esta mesa custa ${formatBRL(PRICES[spread as PricedSpread])} (Pix ou cartão). As cartas são sorteadas assim que o pagamento é confirmado.`}
                </p>

                <fieldset className="min-w-0">
                  <legend className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Gostaria de ouvir a leitura?
                  </legend>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="group" aria-label="Som da consulta">
                    <button
                      type="button"
                      aria-pressed={(narrationChoice ?? soundPref) === true}
                      onClick={() => {
                        setNarrationChoice(true);
                        setSoundPreference(true);
                      }}
                      className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-medium cursor-pointer ${
                        (narrationChoice ?? soundPref) === true
                          ? "border-amber-300 bg-amber-950/50 text-amber-100"
                          : "border-slate-700 bg-slate-950 text-slate-200"
                      }`}
                    >
                      Sim, ouvir a leitura
                    </button>
                    <button
                      type="button"
                      aria-pressed={(narrationChoice ?? soundPref) === false}
                      onClick={() => {
                        setNarrationChoice(false);
                        setSoundPreference(false);
                      }}
                      className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-medium cursor-pointer ${
                        (narrationChoice ?? soundPref) === false
                          ? "border-amber-300 bg-amber-950/50 text-amber-100"
                          : "border-slate-700 bg-slate-950 text-slate-200"
                      }`}
                    >
                      Seguir sem som
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Com som, a narração é preparada enquanto você abre as cartas e começa quando a parte estiver
                    revelada.
                  </p>
                </fieldset>

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
                      <span>
                        {requestIdentity
                          ? "Concluir a mesma consulta"
                          : `Abrir minha mesa · ${SPREADS[spread].count} cartas`}
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-xs leading-relaxed text-slate-400">
                  Interpretação digital simbólica baseada no Petit Lenormand (baralho cigano). Não determina seu futuro
                  nem substitui atendimento profissional ou presencial.
                </p>
              </div>
            </div>
          </form>

          {/* Rodapé sutil de segurança */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs sm:text-sm text-slate-500">
            <span>Sorteio de {SPREADS[spread].count} cartas</span>
            <Link href="/como-funciona" className="underline underline-offset-4 hover:text-slate-300">
              Como funciona
            </Link>
          </div>
        </div>
      )}

      {/* TELA CENTRAL DE CONCENTRAÇÃO / CARREGAMENTO (Olhos abertos -> Olhos fechados concentrando -> Abre os olhos ao concluir) */}
      {requestIdentity && spread !== "line5" && (
        <PaymentModal
          isOpen={payOpen}
          onClose={() => setPayOpen(false)}
          persona={selectedPersona}
          kind="prepaid"
          readingId={requestIdentity.requestId}
          spread={spread as PricedSpread}
          onPaid={(payment) => { setPayOpen(false); void startReading(payment.id); }}
        />
      )}

      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4 sm:p-6 backdrop-blur-md"
        >
          <div className="flex w-full max-w-lg flex-col items-center text-center">
            <div
              className="consultation-preparing-portrait relative h-[min(64dvh,470px)] w-full overflow-hidden rounded-3xl border border-amber-300/45 bg-slate-950 shadow-[0_0_50px_rgba(230,189,120,0.22)]"
              style={{
                backgroundImage: `radial-gradient(ellipse at 50% 30%, ${loadingAssets.accent}40, #120b16 78%)`,
              }}
            >
              {/* Cena base (olhos abertos) */}
              <Image
                src={loadingAssets.scene}
                alt=""
                fill
                sizes="(max-width: 640px) 92vw, 512px"
                className="object-cover object-top"
                priority
              />
              {/* Cena concentrando (olhos fechados) durante a preparação */}
              <Image
                src={loadingAssets.sceneConcentrating}
                alt=""
                fill
                sizes="(max-width: 640px) 92vw, 512px"
                className={`object-cover object-top transition-opacity duration-500 ${
                  loadingPhase === "concentrating" ? "opacity-100" : "opacity-0"
                }`}
                priority
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-slate-950 via-slate-950/60 to-transparent" />
              <div className="absolute inset-x-4 bottom-4 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-amber-200">
                <span>✦ {selectedPersona}</span>
                <span>
                  {loadingPhase === "opening"
                    ? "A mesa se abre"
                    : loadingPhase === "concentrating"
                    ? "Concentrando…"
                    : "Mesa pronta"}
                </span>
              </div>
            </div>

            <h2 className="mt-5 font-serif text-2xl sm:text-3xl text-amber-100">
              {loadingSaved
                ? "Abrindo sua leitura"
                : loadingPhase === "opening"
                ? "A mesa se abre…"
                : loadingPhase === "concentrating"
                ? "Concentrando na sua leitura…"
                : "Sua mesa está pronta"}
            </h2>
            <p className="mt-2.5 max-w-md text-sm sm:text-base leading-relaxed text-slate-200">
              {loadingSaved
                ? "Buscando a leitura que você já começou."
                : loadingPhase === "awakening"
                ? "As cartas foram dispostas na mesa. Entrando na sua consulta…"
                : "Sua leitura está sendo preparada com atenção. Em instantes, os olhos se abrem e você poderá revelar as cartas no seu ritmo."}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
