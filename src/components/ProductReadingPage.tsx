"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { PaymentModal } from "@/components/PaymentModal";
import { formatBRL, PRICES, type ProductKey } from "@/lib/pricing";
import type { NatalChart } from "@/lib/natal";
import type { NumerologyProfile } from "@/lib/numerology";
import styles from "./ProductReadingPage.module.css";

type Product = "numerologia" | "mapa";
type CityOption = { name: string; uf: string };
type Section = { id: string; title: string; text: string; free: boolean };
type Payload = {
  id: string;
  product: ProductKey;
  isPaid: boolean;
  firstName: string;
  persona: string;
  calc: { numerology?: NumerologyProfile; chart?: NatalChart; city?: CityOption; birthTime?: string | null };
  reading: { teaser: string; locked: boolean; sections: Section[] };
};

const PERSONAS = [
  { id: "Oráculo da Galáxia", desc: "Uma linguagem simbólica inspirada no cosmos." },
  { id: "Cigana Tradicional", desc: "Voz acolhedora da cartomancia tradicional." },
  { id: "Linha de Umbanda", desc: "Espiritualidade da Umbanda, com respeito e simbolismo." },
];

const NUM_LABELS: [keyof NumerologyProfile, string][] = [
  ["lifePath", "Caminho de Vida"],
  ["expression", "Expressão"],
  ["soulUrge", "Motivação"],
  ["personality", "Impressão"],
];

const storageKey = (p: Product) => "produto:" + p;
const PLANET_ORDER = ["Sol", "Lua", "Mercúrio", "Vênus", "Marte", "Júpiter", "Saturno", "Urano", "Netuno", "Plutão"];

function Paragraphs({ text }: { text: string }) {
  return <>{text.split(/\n\s*\n/).filter((t) => t.trim()).map((t, i) => <p key={i}>{t.trim()}</p>)}</>;
}

export function ProductReadingPage({ product }: { product: Product }) {
  const isMapa = product === "mapa";
  const [step, setStep] = useState<"form" | "loading" | "result">("form");
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [noTime, setNoTime] = useState(false);
  const [persona, setPersona] = useState(PERSONAS[0].id);
  const [cityText, setCityText] = useState("");
  const [city, setCity] = useState<CityOption | null>(null);
  const [options, setOptions] = useState<(CityOption & { key: string })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Payload | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const identity = useRef<{ requestId: string; requestKey: string } | null>(null);

  // Restaura o resultado salvo nesta sessão do navegador.
  useEffect(() => {
    let id: string | null = null;
    try { id = sessionStorage.getItem(storageKey(product)); } catch { /* sem storage */ }
    if (!id) return;
    let alive = true;
    fetch(`/api/produto/${id}`, { cache: "no-store" })
      .then(async (r) => {
        if (r.ok) {
          const p = (await r.json()) as Payload;
          if (alive) { setData(p); setStep("result"); }
        } else if (r.status === 403 || r.status === 404) {
          try { sessionStorage.removeItem(storageKey(product)); } catch { /* ignora */ }
        }
      })
      .catch(() => {});
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
    if (isMapa && !noTime && !birthTime) return setError("Informe a hora de nascimento ou marque que não sabe.");
    // randomUUID exige contexto seguro (HTTPS/localhost); no celular pela rede local HTTP usa getRandomValues.
    const uuid = () => typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16));
    identity.current ??= { requestId: uuid(), requestKey: uuid() };
    setStep("loading");
    try {
      const res = await fetch("/api/produto/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product, fullName, persona, birthDate,
          birthTime: isMapa && !noTime ? birthTime : "",
          city: isMapa ? city : undefined,
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
      setData(j as Payload);
      setStep("result");
      window.scrollTo({ top: 0 });
    } catch {
      setError("Falha de conexão. Tente de novo; seus dados estão guardados.");
      setStep("form");
    }
  }

  async function refresh() {
    if (!data) return;
    const r = await fetch(`/api/produto/${data.id}`, { cache: "no-store" });
    if (r.ok) setData((await r.json()) as Payload);
  }

  function restart() {
    try { sessionStorage.removeItem(storageKey(product)); } catch { /* ignora */ }
    identity.current = null;
    setData(null);
    setStep("form");
  }

  const title = isMapa ? "Mapa Astral" : "Numerologia";

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>← Voltar</Link>

      {step === "form" && (
        <>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lead}>
            {isMapa
              ? "O céu do momento em que você nasceu, calculado para o seu local e interpretado com cuidado."
              : "Os números do seu nome e da sua data de nascimento, interpretados para o seu momento."}
          </p>
          <form className={styles.form} onSubmit={submit}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="fullName">Nome completo</label>
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
                    Não sei minha hora de nascimento
                  </label>
                </div>
                <div className={styles.box}>
                  Com a hora exata calculamos Ascendente e as 12 casas: o mapa completo é muito mais fiel e revelador. Sem a hora, fazemos o mapa simples (Sol, Lua e planetas por signo).
                  <div className={styles.prices}>
                    <span>Mapa completo: {formatBRL(PRICES["mapa-completo"])}</span>
                    <span>Mapa simples: {formatBRL(PRICES["mapa-simples"])}</span>
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="city">Cidade de nascimento</label>
                  <input
                    id="city" className={styles.input} value={cityText} autoComplete="off" role="combobox" aria-expanded={showOptions} aria-controls="city-list"
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
                  {city ? <span className={styles.picked}>Cidade selecionada.</span> : <span className={styles.hint}>Digite e escolha na lista.</span>}
                </div>
              </>
            )}
            {!isMapa && <div className={styles.box}>Leitura completa por {formatBRL(PRICES.numerologia)}. Uma parte você lê de graça antes de decidir.</div>}

            <fieldset className={styles.personas}>
              <legend className={styles.label} style={{ marginBottom: 8 }}>Quem conduz a sua leitura</legend>
              {PERSONAS.map((p) => (
                <label key={p.id} className={styles.persona} data-on={persona === p.id}>
                  <input type="radio" name="persona" checked={persona === p.id} onChange={() => setPersona(p.id)} />
                  <div className={styles.personaTitle}>{p.id}</div>
                  <div className={styles.personaDesc}>{p.desc}</div>
                </label>
              ))}
            </fieldset>

            {error && <div className={styles.error} role="alert">{error}</div>}
            <button type="submit" className={styles.cta}>{isMapa ? "Calcular meu mapa" : "Revelar meus números"}</button>
          </form>
        </>
      )}

      {step === "loading" && (
        <div className={styles.loading} role="status">
          <div className={styles.orb} />
          <p className={styles.loadingText}>{isMapa ? "Calculando seu mapa…" : "Lendo seus números…"}</p>
          <p className={styles.loadingSub}>Isso pode levar até um minuto. Não feche esta página.</p>
        </div>
      )}

      {step === "result" && data && (
        <Result data={data} isMapa={isMapa} onPay={() => setPayOpen(true)} onRestart={restart} />
      )}

      {data && payOpen && (
        <PaymentModal
          isOpen={payOpen}
          onClose={() => setPayOpen(false)}
          persona={data.persona}
          kind="unlock"
          readingId={data.id}
          spread={data.product}
          onPaid={() => { setPayOpen(false); void refresh(); }}
        />
      )}
    </main>
  );
}

function Result({ data, isMapa, onPay, onRestart }: { data: Payload; isMapa: boolean; onPay: () => void; onRestart: () => void }) {
  const { numerology, chart } = data.calc;
  const free = data.reading.sections.filter((s) => s.free);
  const paid = data.reading.sections.filter((s) => !s.free);
  const locked = data.reading.locked;
  const place = (name: string) => chart?.planets[name];

  return (
    <>
      <h1 className={styles.title}>{isMapa ? "Mapa Astral" : "Numerologia"} de {data.firstName}</h1>

      {numerology && (
        <div className={styles.grid}>
          {NUM_LABELS.map(([k, label]) => (
            <div key={k} className={styles.stat}>
              <div className={styles.statValue}>{String(numerology[k])}</div>
              <div className={styles.statLabel}>{label}</div>
            </div>
          ))}
          <div className={styles.stat}>
            <div className={styles.statValue}>{numerology.personalYear.value}</div>
            <div className={styles.statLabel}>Ano Pessoal {numerology.personalYear.year}</div>
          </div>
        </div>
      )}

      {chart && (
        <>
          <div className={styles.grid} style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className={styles.stat} data-hl="true"><div className={styles.statValue}>{place("Sol")?.sign}</div><div className={styles.statLabel}>Sol</div></div>
            <div className={styles.stat} data-hl="true"><div className={styles.statValue}>{place("Lua")?.sign}</div><div className={styles.statLabel}>Lua</div></div>
            <div className={styles.stat} data-hl="true"><div className={styles.statValue}>{chart.ascendant?.sign ?? "—"}</div><div className={styles.statLabel}>Ascendente</div></div>
          </div>
          <table className={styles.table}>
            <thead><tr><th>Planeta</th><th>Signo</th><th>Grau</th>{chart.mode === "completo" && <th>Casa</th>}</tr></thead>
            <tbody>
              {/* Ordem fixa: o JSONB do Postgres reordena as chaves do objeto. */}
              {PLANET_ORDER.filter((name) => chart.planets[name]).map((name) => [name, chart.planets[name]] as const).map(([name, p]) => (
                <tr key={name}>
                  <td>{name}{p.retrograde ? " R" : ""}</td>
                  <td>{p.sign}</td>
                  <td>{p.degree}°{String(p.minute).padStart(2, "0")}&apos;</td>
                  {chart.mode === "completo" && <td>{p.house ?? ""}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {chart.mode === "simples" && <p className={styles.small}>Ascendente e casas dependem da hora de nascimento; este é o mapa simples.</p>}
          {chart.timeNote && <p className={styles.small}>{chart.timeNote}</p>}
        </>
      )}

      {free.map((s) => (
        <section key={s.id} className={styles.section}>
          <h2 className={styles.sectionTitle}>{s.title}</h2>
          <Paragraphs text={s.text} />
        </section>
      ))}

      {locked ? (
        <>
          {data.reading.teaser && <div className={styles.teaser}><Paragraphs text={data.reading.teaser} /></div>}
          {paid.map((s) => (
            <div key={s.id} className={styles.locked}>
              <div className={styles.lockedHead}><Lock size={16} aria-hidden /> {s.title}</div>
              <div className={styles.blur} aria-hidden />
            </div>
          ))}
          <div className={styles.ctaWrap}>
            <button type="button" className={styles.cta} onClick={onPay}>
              Abrir leitura completa · {formatBRL(PRICES[data.product])}
            </button>
          </div>
        </>
      ) : (
        paid.map((s) => (
          <section key={s.id} className={styles.section}>
            <h2 className={styles.sectionTitle}>{s.title}</h2>
            <Paragraphs text={s.text} />
          </section>
        ))
      )}

      <button type="button" className={styles.again} onClick={onRestart}>Fazer outra leitura</button>
    </>
  );
}
