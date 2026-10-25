export type Polarity = "Positiva" | "Negativa" | "Neutra/Mutável";

export interface Card {
  id: number;
  name: string;
  keywords: string[];
  polarity: Polarity;
  meaningLove: string;
  meaningWork: string;
  meaningGeneral: string;
  imageUrl: string;
}

export interface AiReading {
  card1Reading: string;
  card2Reading: string;
  card3Teaser: string;
  card3Full: string;
  card4Reading: string;
  card5Reading: string;
  generalSynthesis: string;
}

export interface PublicCard {
  id: number | null;
  name: string | null;
  keywords: string[] | null;
  polarity: Polarity | null;
  meaningLove?: string | null;
  meaningWork?: string | null;
  meaningGeneral?: string | null;
  imageUrl: string | null;
  position: number;
}

export interface PublicAiReading {
  card1Reading: string;
  card2Reading: string;
  card3Teaser: string;
  card3Full: string | null;
  card4Reading: string | null;
  card5Reading: string | null;
  generalSynthesis: string | null;
}

export interface ReadingSessionPayload {
  spread?: "line3" | "line5" | "box9" | "grand36";
  sections?: ReadingSection[];
  cardNotes?: { position: number; text: string }[];
  question?: string;
  methodVersion?: string;
  id: string;
  userName: string;
  persona: string;
  theme: string;
  cardsDrawn: PublicCard[];
  aiReading: PublicAiReading;
  isPaid: boolean;
  createdAt: string;
}

export interface ReadingSection {
  id: string;
  title: string;
  positions: number[];
  text: string;
}

export type PersonaType = "Oráculo da Galáxia" | "Cigana Tradicional" | "Linha de Umbanda";
export type ThemeType = "Amor & Relacionamento" | "Trabalho & Dinheiro" | "Amizades & Caminhos";
