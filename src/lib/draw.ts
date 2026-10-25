import crypto from "crypto";
import rawBaralho from "@/data/baralho.json";
import { Card } from "@/types";

const allCards: Card[] = rawBaralho as Card[];

/**
 * Realiza o sorteio criptograficamente aleatório de 5 cartas distintas
 * a partir do acervo de 36 cartas do Baralho Cigano.
 */
export function drawFiveDistinctCards(): Card[] {
  return drawDistinctCards(5);
}

export function drawDistinctCards(count: number): Card[] {
  if (!Number.isInteger(count) || count < 1 || count > allCards.length) {
    throw new Error("O baralho deve conter ao menos 5 cartas.");
  }

  const pool = [...allCards];
  const drawn: Card[] = [];

  for (let i = 0; i < count; i++) {
    // Sorteio criptograficamente seguro com crypto.randomInt
    const selectedIndex = crypto.randomInt(0, pool.length);
    drawn.push(pool[selectedIndex]);
    // Remove para não sortear cartas repetidas na mesma tiragem
    pool.splice(selectedIndex, 1);
  }

  return drawn;
}

export function getAllCards(): Card[] {
  return allCards;
}
