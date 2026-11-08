"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Lock, Sparkles } from "lucide-react";
import { ProductPaymentModal } from "@/components/ProductPaymentModal";
import { formatBRL, PRICES, type ProductKey } from "@/lib/pricing";
import { fetchReady } from "@/lib/fetch-ready";
import type { NatalChart, Placement } from "@/lib/natal";
import ChartWheel from "@/components/ChartWheel";
import { PLANET_GLYPHS, SIGN_GLYPHS } from "@/lib/chart-wheel";
import { CONTACT_NOTICE, MARKETING_LABEL } from "@/lib/contact-notice";
import type { NumerologyProfile } from "@/lib/numerology";
import styles from "./ProductReadingPage.module.css";
import { useElapsedMessage } from "./useElapsedMessage";

type Product = "numerologia" | "mapa";
type CityOption = { name: string; uf: string };
type Section = { id: string; title: string; text: string; free: boolean };
export type ProductPayload = {
  id: string;
  product: ProductKey;
  isPaid: boolean;
  firstName: string;
  calc: { numerology?: NumerologyProfile; chart?: NatalChart; city?: CityOption; birthTime?: string | null };
  reading: { teaser: string; locked: boolean; pending?: boolean; sections: Section[] };
};

const NUM_LABELS: [keyof NumerologyProfile, string, string][] = [
  ["expression", "Expressão", "como você age e se mostra"],
  ["soulUrge", "Motivação", "o que move você por dentro"],
  ["personality", "Impressão", "como os outros veem você"],
];

const storageKey = (p: Product) => "produto:" + p;
const PLANET_ORDER = ["Sol", "Lua", "Mercúrio", "Vênus", "Marte", "Júpiter", "Saturno", "Urano", "Netuno", "Plutão"];
const signGlyph = (p?: Placement) => (p ? SIGN_GLYPHS[Math.floor((((p.longitude % 360) + 360) % 360) / 30)] : "");
const degree = (p: Placement) => `${p.degree}°${String(p.minute).padStart(2, "0")}'`;

/** Linhas da tabela: planetas na ordem fixa, depois nodo, Lilith, Fortuna e os ângulos. */
function chartRows(chart: NatalChart): [string, Placement][] {
  const rows: [string, Placement | undefined][] = [
    ...PLANET_ORDER.map((n) => [n, chart.planets[n]] as [string, Placement | undefined]),
    ["Nodo Norte", chart.northNode],
    ["Lilith", chart.lilith as Placement | undefined],
    ["Parte da Fortuna", chart.fortune],
    ["Ascendente", chart.ascendant],
    ["Meio do Céu", chart.midheaven],
  ];
  return rows.filter((r): r is [string, Placement] => Boolean(r[1]));
}

function Paragraphs({ text }: { text: string }) {
  return <>{text.split(/\n\s*\n/).filter((t) => t.trim()).map((t, i) => <p key={i}>{t.trim()}</p>)}</>;
}

function TopBar() {
  return (
    <header className={styles.top}>
      <Link href="/" className={styles.back}><ArrowLeft size={16} aria-hidden /> Início</Link>
      <span className={styles.brand}>Oráculo Cósmico</span>
    </header>
  );
}

export function ProductReadingPage({ product }: { product: Product }) {
  const isMapa = product === "mapa";
  const [step, setStep] = useState<"form" | "loading" | "result">("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [noTime, setNoTime] = useState(false);
  const [cityText, setCityText] = useState("");
  const [city, setCity] = useState<CityOption | null>(null);
  const [options, setOptions] = useState<(CityOption & { key: string })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProductPayload | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  // Voltando do pagamento, a espera é pela leitura completa (as mensagens mudam).
  const [loadingPaid, setLoadingPaid] = useState(false);
  const loadingText = useElapsedMessage(step === "loading", loadingPaid ? [
    { at: 0, text: "Abrindo a sua leitura completa…" },
    { at: 6, text: "Escrevendo as seções da sua leitura completa…" },
    { at: 25, text: "Falta pouco. Não feche esta página…" },
    { at: 60, text: "Está levando um pouco mais que o normal, mas segue em andamento…" },
  ] : [
    { at: 0, text: isMapa ? "Calculando o seu mapa…" : "Calculando os seus números…" },
    { at: 4, text: isMapa ? "Posicionando os planetas no dia do seu nascimento…" : "Somando as letras do seu nome…" },
    { at: 12, text: "Escrevendo a sua leitura gratuita…" },
    { at: 30, text: "Quase lá: revisando o texto…" },
    { at: 55, text: "Está levando um pouco mais que o normal, mas segue em andamento…" },
  ]);
  const identity = useRef<{ requestId: string; requestKey: string } | null>(null);

  // Restaura o resultado salvo nesta sessão do navegador. Voltando do pagamento (?pagamento=), reabre o
  // modal, que retoma a espera pela confirmação.
  useEffect(() => {
    let id: string | null = null;
    try { id = sessionStorage.getItem(storageKey(product)); } catch { /* sem storage */ }
    const returning = new URLSearchParams(window.location.search).has("pagamento");
    if (returning) window.history.replaceState(null, "", window.location.pathname);
    if (!id) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingPaid(returning);
    setStep("loading");
    fetchReady(`/api/produto/${id}`)
      .then(async (r) => {
        if (!alive) return;
        if (r.ok) {
          const p = (await r.json()) as ProductPayload;
          if (!alive) return;
          setData(p);
          setStep("result");
          if (returning && !p.isPaid) setPayOpen(true);
          return;
        }
        if (r.status === 403 || r.status === 404) {
          try { sessionStorage.removeItem(storageKey(product)); } catch { /* ignora */ }
        }
        setStep("form");
      })
      .catch((err) => { if (alive) { setError(err instanceof Error ? err.message : "Não foi possível abrir a leitura."); setStep("form"); } });
    return () => { alive = false; };
  }, [product]);

  // Autocomplete de cidades (debounce 250ms).
  useEffect(() => {
    if (!isMapa || city || cityText.trim().length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      fetch(`/api/cidades?q=${encodeURIComponent(cityText.trim())}`)
        .then((r) => (r.ok ? r.json() : { cities: [] }))
        .then((j: { cities: CityOption[] }) => { if (alive) setOptions(j.cities.map((c) => ({ ...c, key: `${c.name}-${c.uf}` }))); })
        .catch(() => {});
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [cityText, city, isMapa]);

  const showOptions = isMapa && !city && cityText.trim().length >= 2 && options.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 3) return setError("Informe seu nome completo.");
    if (!birthDate) return setError("Informe sua data de nascimento.");
    if (isMapa && !city) return setError("Escolha a cidade de nascimento na lista.");
    if (isMapa && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Informe um e-mail válido.");
    if (isMapa && !noTime && !birthTime) return setError("Informe a hora de nascimento ou marque que não sabe.");
    // randomUUID exige contexto seguro (HTTPS/localhost); no celular pela rede local HTTP usa getRandomValues.
    const uuid = () => typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16));
    identity.current ??= { requestId: uuid(), requestKey: uuid() };
    setLoadingPaid(false);
    setStep("loading");
    window.scrollTo({ top: 0 });
    try {
      const res = await fetch("/api/produto/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product, fullName, birthDate,
          birthTime: isMapa && !noTime ? birthTime : "",
          city: isMapa ? city : undefined,
          email: isMapa ? email : undefined,
          marketing: isMapa ? marketing : undefined,
          ...identity.current,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Erro de validação (400) exige novos dados; os demais mantêm a identidade para reaproveitar o salvo.
        if (res.status === 400) identity.current = null;
        setError(j.error || "Não foi possível preparar sua leitura agora.");
        setStep("form");
        return;
      }
      try { sessionStorage.setItem(storageKey(product), j.id); } catch { /* ignora */ }
      setData(j as ProductPayload);
      setStep("result");
      window.scrollTo({ top: 0 });
    } catch {
      setError("Falha de conexão. Tente de novo; seus dados estão guardados.");
      setStep("form");
    }
  }

  async function refresh() {
    if (!data) return;
    try {
      const r = await fetchReady(`/api/produto/${data.id}`);
      if (r.ok) setData((await r.json()) as ProductPayload);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Não foi possível abrir a leitura completa. Recarregue a página.");
    }
  }

  function restart() {
    try { sessionStorage.removeItem(storageKey(product)); } catch { /* ignora */ }
    identity.current = null;
    setData(null);
    setStep("form");
    window.scrollTo({ top: 0 });
  }

  return (
    <main className={`ed ${styles.page}`}>
      <div className={styles.wrap}>
        <TopBar />

        {step === "form" && (
          <>
            <section className={styles.hero}>
              <p className={styles.eyebrow}>{isMapa ? "Mapa astral grátis" : "Numerologia pitagórica"}</p>
              <h1 className={styles.title}>{isMapa ? "O céu do dia em que você nasceu" : "Os números que contam a sua história"}</h1>
              <p className={styles.lead}>
                {isMapa
                  ? "Calculamos as posições exatas dos planetas para a data, a hora e a cidade do seu nascimento, e interpretamos o que elas dizem sobre você."
                  : "O seu nome completo e a sua data de nascimento revelam o seu Caminho de Vida, a sua Expressão, o que move você e o ciclo que está vivendo agora."}
              </p>
              <ul className={styles.perks}>
                {(isMapa
                  ? ["Roda do mapa, planetas, casas e aspectos", "Leitura de Sol, Lua e Ascendente grátis", `Leitura completa por ${formatBRL(PRICES["mapa-completo"])}`]
                  : ["Seus 5 números principais", "Leitura do Caminho de Vida grátis", `Leitura completa por ${formatBRL(PRICES.numerologia)}`]
                ).map((t) => <li key={t}><Sparkles size={14} aria-hidden /> {t}</li>)}
              </ul>
            </section>

            <form className={styles.card} onSubmit={submit} noValidate>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="fullName">{isMapa ? "Seu nome" : "Nome completo"}</label>
                <input id="fullName" className={styles.input} value={fullName} maxLength={80} autoComplete="name" onChange={(e) => setFullName(e.target.value)} />
                {!isMapa && <span className={styles.hint}>Como na certidão de nascimento.</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="birthDate">Data de nascimento</label>
                <input id="birthDate" type="date" className={styles.input} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>

              {isMapa && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="birthTime">Hora de nascimento</label>
                    <input id="birthTime" type="time" className={styles.input} value={birthTime} disabled={noTime} onChange={(e) => setBirthTime(e.target.value)} />
                    <label className={styles.check}>
                      <input type="checkbox" checked={noTime} onChange={(e) => setNoTime(e.target.checked)} />
                      Não sei a hora
                    </label>
                    <span className={styles.hint}>
                      Com a hora calculamos o Ascendente e as 12 casas. Sem ela, fazemos o mapa simples (leitura completa por {formatBRL(PRICES["mapa-simples"])}).
                    </span>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="city">Cidade de nascimento</label>
                    <input
                      id="city" className={styles.input} value={cityText} autoComplete="off" role="combobox" aria-expanded={showOptions} aria-controls="city-list"
                      placeholder="Digite e escolha na lista"
                      onChange={(e) => { setCityText(e.target.value); setCity(null); }}
                    />
                    {showOptions && (
                      <ul id="city-list" className={styles.dropdown} role="listbox">
                        {options.map((o) => (
                          <li key={o.key} role="option" aria-selected={false}>
                            <button type="button" onClick={() => { setCity({ name: o.name, uf: o.uf }); setCityText(`${o.name} — ${o.uf}`); setOptions([]); }}>
                              {o.name} — {o.uf}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {city && <span className={styles.picked}>Cidade selecionada.</span>}
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="email">Seu e-mail</label>
                    <input id="email" type="email" inputMode="email" className={styles.input} value={email} maxLength={120} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
                    <span className={styles.hint}>{CONTACT_NOTICE}</span>
                    <label className={styles.check}>
                      <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
                      {MARKETING_LABEL}
                    </label>
                  </div>
                </>
              )}

              {error && <div className={styles.error} role="alert">{error}</div>}
              <button type="submit" className={styles.cta}>{isMapa ? "Calcular meu mapa grátis" : "Revelar meus números"}</button>
            </form>
          </>
        )}

        {step === "loading" && (
          <div className={styles.loading} role="status">
            <div className={styles.orbit} aria-hidden="true"><span /></div>
            <p className={styles.loadingText} aria-live="polite">{loadingText}</p>
            <p className={styles.loadingSub}>Não feche esta página. A leitura é escrita para você.</p>
          </div>
        )}

        {step === "result" && data && (
          <ProductResult data={data} onPay={() => setPayOpen(true)} onRestart={restart} />
        )}
      </div>

      {data && payOpen && (
        <ProductPaymentModal
          isOpen={payOpen}
          onClose={() => setPayOpen(false)}
          readingId={data.id}
          product={data.product}
          firstName={data.firstName}
          includes={data.reading.sections.filter((s) => !s.free).map((s) => s.title)}
          onPaid={async () => { await refresh(); setPayOpen(false); }}
        />
      )}
    </main>
  );
}

/** Página de exemplo (só em desenvolvimento): mostra o resultado sem banco, IA nem pagamento. */
export function ProductPreview({ data }: { data: ProductPayload }) {
  const [open, setOpen] = useState(false);
  return (
    <main className={`ed ${styles.page}`}>
      <div className={styles.wrap}>
        <TopBar />
        <p className={styles.devNote}>Página de exemplo (só no computador de desenvolvimento). Os textos das seções são de exemplo.</p>
        <ProductResult data={data} onPay={() => setOpen(true)} onRestart={() => {}} />
      </div>
      {/* Modal real; pagar aqui só devolve "acesso não autorizado" (a consulta de exemplo não existe no banco). */}
      <ProductPaymentModal
        isOpen={open}
        onClose={() => setOpen(false)}
        readingId={data.id}
        product={data.product}
        firstName={data.firstName}
        includes={data.reading.sections.filter((s) => !s.free).map((s) => s.title)}
        onPaid={() => setOpen(false)}
      />
    </main>
  );
}

function ProductResult({ data, onPay, onRestart }: { data: ProductPayload; onPay: () => void; onRestart: () => void }) {
  const { numerology, chart, city, birthTime } = data.calc;
  const isMapa = Boolean(chart);
  const free = data.reading.sections.filter((s) => s.free);
  const paid = data.reading.sections.filter((s) => !s.free);
  const locked = data.reading.locked;
  const price = formatBRL(PRICES[data.product]);

  return (
    <div className={locked ? styles.withBar : undefined}>
      <section className={styles.resultHead}>
        <p className={styles.eyebrow}>{isMapa ? "Mapa astral" : "Numerologia"}</p>
        <h1 className={styles.title}>{data.firstName}</h1>
        {city && <p className={styles.meta}>{city.name} — {city.uf}{birthTime ? ` · ${birthTime}` : " · hora não informada"}</p>}
      </section>

      {numerology && (
        <>
          <div className={styles.lifePath}>
            <span className={styles.lifeNum}>{numerology.lifePath}</span>
            <span className={styles.lifeLabel}>Caminho de Vida<small>o tipo de jornada que você veio fazer</small></span>
          </div>
          <div className={styles.numGrid}>
            {NUM_LABELS.map(([k, label, desc]) => (
              <div key={k} className={styles.num}>
                <span className={styles.numValue}>{String(numerology[k])}</span>
                <span className={styles.numLabel}>{label}</span>
                <span className={styles.numDesc}>{desc}</span>
              </div>
            ))}
            <div className={styles.num}>
              <span className={styles.numValue}>{numerology.personalYear.value}</span>
              <span className={styles.numLabel}>Ano Pessoal {numerology.personalYear.year}</span>
              <span className={styles.numDesc}>o ciclo que você vive agora</span>
            </div>
          </div>
        </>
      )}

      {chart && (
        <>
          <div className={styles.trio}>
            {([["Sol", chart.planets["Sol"], "essência"], ["Lua", chart.planets["Lua"], "emoções"], ["Ascendente", chart.ascendant, "como você chega"]] as const).map(([label, p, hint]) => (
              <div key={label} className={styles.trioItem}>
                <span className={styles.trioGlyph} aria-hidden="true">{p ? signGlyph(p) : "?"}</span>
                <span className={styles.trioLabel}>{label}</span>
                <span className={styles.trioSign}>{p?.sign ?? "sem hora"}</span>
                <span className={styles.trioHint}>{p ? `${hint} · ${p.decan}º decanato` : hint}</span>
              </div>
            ))}
          </div>

          <figure className={styles.wheelCard}>
            <div className={styles.wheel}><ChartWheel chart={chart} /></div>
            <figcaption className={styles.small}>
              {chart.mode === "completo" ? "Ascendente à esquerda, Meio do Céu no alto. As linhas ligam planetas em aspecto." : "Mapa simples: sem a hora, não há Ascendente nem casas."}
            </figcaption>
          </figure>

          <div className={styles.card}>
            <h2 className={styles.h2}>Posições</h2>
            <table className={styles.table}>
              <thead><tr><th>Ponto</th><th>Signo</th><th>Grau</th>{chart.mode === "completo" && <th>Casa</th>}</tr></thead>
              <tbody>
                {/* Ordem fixa: o JSONB do Postgres reordena as chaves do objeto. Mapas antigos não têm Lilith/Fortuna. */}
                {chartRows(chart).map(([name, p]) => (
                  <tr key={name}>
                    <td>
                      <span className={styles.glyph} aria-hidden="true">{PLANET_GLYPHS[name] ?? ""}</span>
                      {name}{p.retrograde ? <span className={styles.retro} title="retrógrado"> ℞</span> : null}
                      {p.dignities?.length ? <span className={styles.dignity}>{p.dignities.join(", ")}</span> : null}
                    </td>
                    <td><span className={styles.glyph} aria-hidden="true">{signGlyph(p)}</span>{p.sign}</td>
                    <td className={styles.num2}>{degree(p)}</td>
                    {chart.mode === "completo" && <td className={styles.num2}>{p.house ?? ""}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {chart.elementsWeighted && Object.keys(chart.elementsWeighted).length > 0 && (
            <div className={styles.card}>
              <h2 className={styles.h2}>Elementos</h2>
              {Object.entries(chart.elementsWeighted).map(([el, pct]) => (
                <div key={el} className={styles.bar}>
                  <span>{el}</span>
                  <span className={styles.barTrack}><span className={styles.barFill} data-el={el} style={{ width: `${pct}%` }} /></span>
                  <span className={styles.num2}>{pct}%</span>
                </div>
              ))}
              {chart.polarity && <p className={styles.small}>Polaridade: Yang (Fogo e Ar) {chart.polarity.Yang}% · Yin (Terra e Água) {chart.polarity.Yin}%</p>}
              <p className={styles.small}>Peso maior para Sol, Lua e Ascendente; menor para os planetas lentos.</p>
            </div>
          )}
          {chart.timeNote && <p className={styles.small}>{chart.timeNote}</p>}
        </>
      )}

      {free.map((s) => (
        <section key={s.id} className={styles.reading}>
          <h2 className={styles.h2}>{s.title}</h2>
          <Paragraphs text={s.text} />
        </section>
      ))}

      {locked ? (
        <section className={styles.lockedWrap}>
          <h2 className={styles.h2}>O que a leitura completa revela</h2>
          {data.reading.teaser && <blockquote className={styles.teaser}><Paragraphs text={data.reading.teaser} /></blockquote>}
          <ul className={styles.lockedList}>
            {paid.map((s) => (
              <li key={s.id} className={styles.locked}>
                <span className={styles.lockedHead}><Lock size={15} aria-hidden /> {s.title}</span>
                <span className={styles.blur} aria-hidden="true" />
              </li>
            ))}
          </ul>
          <button type="button" className={styles.cta} onClick={onPay}>Revelar a leitura completa · {price}</button>
          <p className={styles.small} style={{ textAlign: "center" }}>Pagamento único, com Pix ou cartão.</p>
        </section>
      ) : (
        paid.map((s) => (
          <section key={s.id} className={styles.reading}>
            <h2 className={styles.h2}>{s.title}</h2>
            <Paragraphs text={s.text} />
          </section>
        ))
      )}

      <nav className={styles.more} aria-label="Outras leituras">
        <p className={styles.eyebrow}>Continue se conhecendo</p>
        {isMapa ? <Link href="/numerologia">Numerologia</Link> : <Link href="/mapa-astral">Mapa astral grátis</Link>}
        <Link href="/baralho-cigano">Baralho Cigano</Link>
        <button type="button" onClick={onRestart}>Fazer outra leitura</button>
      </nav>

      {locked && (
        <div className={styles.bar2}>
          <span className={styles.bar2Price}>{price}<small>leitura completa</small></span>
          <button type="button" className={styles.bar2Btn} onClick={onPay}>Revelar tudo</button>
        </div>
      )}
    </div>
  );
}
