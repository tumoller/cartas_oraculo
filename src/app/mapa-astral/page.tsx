import type { Metadata } from "next";
import { ProductReadingPage } from "@/components/ProductReadingPage";

export const metadata: Metadata = {
  title: "Mapa Astral | Oráculo Cósmico",
  description: "Seu mapa astral personalizado: Sol, Lua, Ascendente, planetas e casas, com leitura interpretada.",
};

export default function Page() {
  return <ProductReadingPage product="mapa" />;
}
