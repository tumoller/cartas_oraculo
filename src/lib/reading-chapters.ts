import type { ReadingSection } from "@/types";
import type { SpreadId } from "./spread-config";

export function themeFocusId(theme: string): number {
  return theme === "Amor & Relacionamento" ? 24 : theme === "Trabalho & Dinheiro" ? 34 : 22;
}

const titles: Partial<Record<SpreadId, Record<string, string>>> = {
  line3: { section1: "As três cartas em conjunto" },
  box9: {
    section1: "Linha 1 do quadro", section2: "Linha 2 do quadro", section3: "Linha 3 do quadro",
    section4: "Colunas e carta central", section5: "Diagonais do quadro",
  },
  grand36: {
    section1: "Linha 1 da mesa", section2: "Linha 2 da mesa", section3: "Linha 3 da mesa", section4: "Linha 4 da mesa",
    section5: "Vizinhança do tema · mesa de 36 cartas", section6: "Os quatro cantos da mesa",
  },
};

export function chapterTitle(spread: SpreadId, id: string, fallback = ""): string {
  return titles[spread]?.[id] || fallback;
}

export function chapterHint(spread: SpreadId, id: string): string {
  if (spread === "line3" && id === "section1") return "As combinações, a carta central e o espelho formam uma única leitura.";
  if (spread === "box9") {
    if (/^section[1-3]$/.test(id)) return "Esta linha mostra relações entre as cartas colocadas lado a lado no quadro de nove.";
    if (id === "section4") return "As colunas ligam as cartas na vertical; a carta central é o cruzamento, não outra tiragem.";
    if (id === "section5") return "As duas diagonais cruzam a carta central e oferecem outra relação dentro do mesmo quadro.";
  }
  if (spread === "grand36") {
    if (/^section[1-4]$/.test(id)) return "Nove cartas de uma mesma linha. Veja o sentido do conjunto e depois explore cada imagem.";
    if (id === "section5") return "A carta do tema e suas vizinhas imediatas dentro da mesa de 36 cartas.";
    if (id === "section6") return "Uma leitura das relações entre as quatro cartas que ocupam os cantos da mesa.";
  }
  return "";
}

// Textos e posições de leituras salvas permanecem intactos.
export function presentationSections(spread: SpreadId, sections: ReadingSection[]): ReadingSection[] {
  return sections.map((section) => ({ ...section, title: chapterTitle(spread, section.id, section.title) }));
}

export function canReadChapter(spread: SpreadId, id: string, positions: number[], revealed: number, total: number, methodVersion?: string): boolean {
  if (positions.length === 0 || !positions.every((position) => position <= revealed)) return false;
  // Older texts can connect other rows; preserve them and wait for the full table.
  if (spread === "grand36" && /^section[1-4]$/.test(id) && methodVersion === "lenormand-grand36-v2") return true;
  return revealed >= total;
}
