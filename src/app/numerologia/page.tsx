import type { Metadata } from "next";
import { ProductReadingPage } from "@/components/ProductReadingPage";

export const metadata: Metadata = {
  title: "Numerologia | Oráculo Cósmico",
  description: "Descubra seu Caminho de Vida, Expressão, Motivação e Ano Pessoal com uma leitura numerológica personalizada.",
};

export default function Page() {
  return <ProductReadingPage product="numerologia" />;
}
