export const SPREADS = {
  line3: { title: "Pergunta em três cartas", count: 3 },
  line5: { title: "Consulta de cinco cartas", count: 5 },
  box9: { title: "Quadro de nove cartas", count: 9 },
  grand36: { title: "Mesa completa de 36 cartas", count: 36 },
} as const;
export type SpreadId = keyof typeof SPREADS;
export type ReadingDepth = "basic" | "complete";
