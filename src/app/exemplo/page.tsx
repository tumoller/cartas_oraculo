import { notFound } from "next/navigation";
import { ProductPreview, type ProductPayload } from "@/components/ProductReadingPage";
import { natalChart } from "@/lib/natal";
import { numerologyProfile } from "@/lib/numerology";
import { productSections } from "@/lib/products";
import type { ProductKey } from "@/lib/pricing";

// Só em desenvolvimento: mostra o resultado do mapa/numerologia com cálculo real e textos de exemplo,
// sem banco, IA ou pagamento. /exemplo?p=mapa|simples|numerologia&aberto=1
const SAMPLE = "Texto de exemplo. Na leitura real, este espaço traz a interpretação escrita para a pessoa, citando os signos, as casas, os aspectos ou os números do mapa dela.\n\nO segundo parágrafo aprofunda o tema com exemplos práticos e um conselho para o momento atual. Cada seção tem entre 110 e 250 palavras.";

export default async function Exemplo({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { p = "mapa", aberto } = await searchParams;
  const product: ProductKey = p === "numerologia" ? "numerologia" : p === "simples" ? "mapa-simples" : "mapa-completo";
  const isPaid = aberto === "1";
  const place = { lat: -23.5329, lon: -46.6395, timeZone: "America/Sao_Paulo" };
  const calc: ProductPayload["calc"] = product === "numerologia"
    ? { numerology: numerologyProfile("Maria Clara Souza", { year: 1990, month: 5, day: 14 }) }
    : {
        chart: natalChart({ date: { year: 1991, month: 3, day: 1 }, time: product === "mapa-completo" ? { hour: 21, minute: 45 } : undefined, place }),
        city: { name: "São Paulo", uf: "SP" },
        birthTime: product === "mapa-completo" ? "21:45" : null,
      };
  const data: ProductPayload = {
    id: "00000000-0000-4000-8000-000000000001",
    product,
    isPaid,
    firstName: product === "numerologia" ? "Maria" : "Arthur",
    calc,
    reading: {
      teaser: "Frase de exemplo que antecipa o tema mais marcante da leitura completa, sem revelar tudo.",
      locked: !isPaid,
      sections: productSections(product).map((s) => ({ ...s, text: s.free || isPaid ? SAMPLE : "" })),
    },
  };
  return <ProductPreview data={JSON.parse(JSON.stringify(data))} />;
}
