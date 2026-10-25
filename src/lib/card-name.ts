// A carta mantém seu número e fundamento; o nome acompanha a arte do baralho.
export function cardNameForDeck(card: { id: number | null; name: string | null }, persona: string) {
  return card.id === 11 && persona === "Cigana Tradicional" ? "11. A Vassoura" : card.name;
}
