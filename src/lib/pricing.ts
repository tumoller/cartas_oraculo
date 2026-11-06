// Preços em centavos. Compartilhado entre cliente e servidor; o servidor é a fonte da cobrança.
// numerologia/mapa-*: valores PROVISÓRIOS da V1, a definir após a pesquisa de mercado.
export const PRICES = { line5: 990, box9: 1990, grand36: 3990, numerologia: 1490, "mapa-simples": 1990, "mapa-completo": 3490 } as const;
export type PricedSpread = keyof typeof PRICES;
export const PRODUCT_KEYS = ["numerologia", "mapa-simples", "mapa-completo"] as const;
export type ProductKey = (typeof PRODUCT_KEYS)[number];
export const isProductKey = (value: string): value is ProductKey => (PRODUCT_KEYS as readonly string[]).includes(value);

export const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function validCpf(raw: string): boolean {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const size of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(cpf[i]) * (size + 1 - i);
    const digit = ((sum * 10) % 11) % 10;
    if (digit !== Number(cpf[size])) return false;
  }
  return true;
}
