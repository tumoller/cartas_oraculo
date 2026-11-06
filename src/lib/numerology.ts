// Numerologia pitagórica. Cálculo determinístico: a IA só interpreta os números prontos.

const MASTER = new Set([11, 22, 33]);

/** Soma dígitos até 1 dígito, preservando números mestres (11, 22, 33). */
export function reduce(n: number, keepMaster = true): number {
  while (n > 9 && !(keepMaster && MASTER.has(n))) {
    n = String(n).split("").reduce((s, d) => s + Number(d), 0);
  }
  return n;
}

const letterValue = (ch: string) => ((ch.charCodeAt(0) - 65) % 9) + 1; // A=1 ... I=9, J=1 ...
const VOWELS = new Set(["A", "E", "I", "O", "U"]);

/** Remove acentos, Ç→C, deixa só A-Z. */
export function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z]/g, "");
}

function nameNumber(name: string, filter: (ch: string) => boolean): number {
  const letters = normalizeName(name).split("").filter(filter);
  return reduce(letters.reduce((s, ch) => s + letterValue(ch), 0));
}

export type BirthDate = { day: number; month: number; year: number };

export function validBirthDate({ day, month, year }: BirthDate, now = new Date()): boolean {
  if (![day, month, year].every(Number.isInteger) || year < 1900) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day && d.getTime() <= now.getTime();
}

/** Caminho de Vida: reduz dia, mês e ano separadamente e depois soma (método mais comum). */
export function lifePath({ day, month, year }: BirthDate): number {
  return reduce(reduce(day) + reduce(month) + reduce(year));
}

/** Ano Pessoal: dia + mês de nascimento + ano corrente. Mestres não se aplicam. */
export function personalYear({ day, month }: BirthDate, year: number): number {
  return reduce(reduce(day) + reduce(month) + reduce(year), false);
}

export type NumerologyProfile = {
  fullName: string;
  birth: BirthDate;
  lifePath: number;        // Caminho de Vida (data)
  expression: number;      // Expressão/Destino (todas as letras)
  soulUrge: number;        // Motivação/Alma (vogais)
  personality: number;     // Impressão/Personalidade (consoantes)
  birthday: number;        // Dia de nascimento
  personalYear: { year: number; value: number };
  nextPersonalYear: { year: number; value: number };
  age: number;
};

export function numerologyProfile(fullName: string, birth: BirthDate, now = new Date()): NumerologyProfile {
  const year = now.getFullYear();
  const hadBirthday = now.getMonth() + 1 > birth.month || (now.getMonth() + 1 === birth.month && now.getDate() >= birth.day);
  return {
    fullName: fullName.trim().replace(/\s+/g, " "),
    birth,
    lifePath: lifePath(birth),
    expression: nameNumber(fullName, () => true),
    soulUrge: nameNumber(fullName, (ch) => VOWELS.has(ch)),
    personality: nameNumber(fullName, (ch) => !VOWELS.has(ch)),
    birthday: reduce(birth.day),
    personalYear: { year, value: personalYear(birth, year) },
    nextPersonalYear: { year: year + 1, value: personalYear(birth, year + 1) },
    age: year - birth.year - (hadBirthday ? 0 : 1),
  };
}
