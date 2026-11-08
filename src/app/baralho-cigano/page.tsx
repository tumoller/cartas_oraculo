import type { Metadata } from "next";
import CardsApp from "@/components/CardsApp";

export const metadata: Metadata = {
  title: "Baralho Cigano Lenormand",
  description: "Tiragem de cartas do Baralho Cigano com leitura oracular combinada e temática universal.",
};

export default function Page() {
  return <CardsApp />;
}
