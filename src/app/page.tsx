import Image from "next/image";
import Link from "next/link";
import ChartWheel from "@/components/ChartWheel";
import { natalChart } from "@/lib/natal";
import { formatBRL, PRICES } from "@/lib/pricing";
import s from "./Home.module.css";

const STEPS = [
  "Escolha a leitura e informe os seus dados.",
  "Veja uma parte da leitura na hora, sem pagar.",
  "Abra a leitura completa com Pix ou cartão, em uma página segura.",
];

const TRUST = [
  "Cálculo astronômico com efemérides: zodíaco tropical e casas Placidus.",
  "Pagamento seguro pela InfinitePay, com Pix ou cartão.",
  "Seus dados não são vendidos nem compartilhados para publicidade.",
];

export default function Home() {
  const chart = natalChart({
    date: { year: 2000, month: 1, day: 1 },
    time: { hour: 12, minute: 0 },
    place: { lat: -23.5329, lon: -46.6395, timeZone: "America/Sao_Paulo" },
  });

  return (
    <main className={`ed ${s.page}`}>
      <div className={s.wrap}>
        <header className={s.header}>
          <span className={s.mark} aria-hidden="true">✦{"︎"}</span>
          <span className={s.wordmark}>Oráculo Cósmico</span>
        </header>

        <section className={s.hero} aria-labelledby="hero-title">
          <p className={s.eyebrow}>Autoconhecimento com método</p>
          <h1 id="hero-title" className={s.h1}>O que o céu, os números e as cartas dizem sobre você</h1>
          <p className={s.lead}>
            Escolha por onde começar. O seu mapa astral é grátis, e as outras leituras mostram uma parte antes de você decidir.
          </p>
          <Link href="/mapa-astral" className={s.primary}>Calcular meu mapa grátis</Link>
        </section>

        <section className={s.products} aria-labelledby="products-title">
          <h2 id="products-title" className={s.h2}>Escolha a sua leitura</h2>
          <div className={s.grid}>
            <article className={s.card}>
              <div className={s.art}>
                <span className={s.badge}>Grátis</span>
                <div className={s.wheel} aria-hidden="true"><ChartWheel chart={chart} /></div>
              </div>
              <h3 className={s.h3}>Mapa Astral</h3>
              <p className={s.desc}>Sol, Lua, Ascendente, casas e aspectos calculados para a data, a hora e a cidade em que você nasceu.</p>
              <p className={s.price}>Mapa grátis · leitura completa {formatBRL(PRICES["mapa-completo"])}</p>
              <Link href="/mapa-astral" className={s.cta}>Calcular meu mapa</Link>
            </article>

            <article className={s.card}>
              <div className={s.art}>
                <div className={s.numbers} aria-hidden="true">
                  <span className={s.ring} />
                  <span className={s.line} />
                  <span className={`${s.num} ${s.n1}`}>1</span>
                  <span className={`${s.num} ${s.n7}`}>7</span>
                  <span className={`${s.num} ${s.n22}`}>22</span>
                </div>
              </div>
              <h3 className={s.h3}>Numerologia</h3>
              <p className={s.desc}>Os números do seu nome e da sua data de nascimento: Caminho de Vida, Expressão, Motivação e o seu Ano Pessoal.</p>
              <p className={s.price}>Prévia grátis · leitura completa {formatBRL(PRICES.numerologia)}</p>
              <Link href="/numerologia" className={s.cta}>Descobrir meus números</Link>
            </article>

            <article className={`${s.card} ${s.dark}`}>
              <div className={s.art}>
                <div className={s.fan} aria-hidden="true">
                  <Image className={`${s.fcard} ${s.f1}`} src="/cards/cigano/card-1.jpg" alt="" width={768} height={1376} />
                  <Image className={`${s.fcard} ${s.f3}`} src="/cards/cigano/card-24.jpg" alt="" width={768} height={1376} />
                  <Image className={`${s.fcard} ${s.f2}`} src="/cards/cigano/card-10.jpg" alt="" width={768} height={1376} />
                </div>
              </div>
              <h3 className={s.h3}>Baralho Cigano</h3>
              <p className={s.desc}>Faça a sua pergunta e tire as cartas do Baralho Cigano Lenormand, com a leitura feita para a sua pergunta.</p>
              <p className={s.price}>A partir de {formatBRL(PRICES.line5)}</p>
              <Link href="/baralho-cigano" className={`${s.cta} ${s.ctaGold}`}>Tirar as cartas</Link>
            </article>
          </div>
        </section>

        <section className={s.how} aria-labelledby="how-title">
          <h2 id="how-title" className={s.h2}>Como funciona</h2>
          <ol className={s.steps}>
            {STEPS.map((t, i) => (
              <li key={t} className={s.step}>
                <span className={s.stepNum} aria-hidden="true">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={s.trust} aria-label="Confiança e segurança">
          <ul className={s.trustList}>
            {TRUST.map((t) => (
              <li key={t} className={s.trustItem}>
                <span className={s.glyph} aria-hidden="true">✦{"︎"}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className={s.footer}>
          <p>© Oráculo Cósmico</p>
          <p>Leituras para autoconhecimento. Não substituem orientação médica, psicológica, jurídica ou financeira.</p>
        </footer>
      </div>
    </main>
  );
}
