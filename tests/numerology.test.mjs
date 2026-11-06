import { test } from "node:test";
import assert from "node:assert/strict";
import { reduce, normalizeName, lifePath, personalYear, numerologyProfile, validBirthDate } from "../src/lib/numerology.ts";

test("reduz preservando mestres", () => {
  assert.equal(reduce(38), 11);
  assert.equal(reduce(29), 11);
  assert.equal(reduce(22), 22);
  assert.equal(reduce(1987), 7); // 25 -> 7
  assert.equal(reduce(29, false), 2);
});

test("normaliza acentos e cedilha", () => {
  assert.equal(normalizeName("João Conceição"), "JOAOCONCEICAO");
});

test("caminho de vida e ano pessoal", () => {
  // 15/07/1990: 6 + 7 + 1 (19->10->1) = 14 -> 5
  assert.equal(lifePath({ day: 15, month: 7, year: 1990 }), 5);
  // 29/11/1984: 11 + 11 + 22 = 44 -> 8
  assert.equal(lifePath({ day: 29, month: 11, year: 1984 }), 8);
  // 15/07 em 2026: 6 + 7 + 1 = 14 -> 5
  assert.equal(personalYear({ day: 15, month: 7 }, 2026), 5);
});

test("perfil pelo nome", () => {
  // ANA: A1 N5 A1 = 7; vogais 2; consoantes 5
  const p = numerologyProfile("Ana", { day: 15, month: 7, year: 1990 }, new Date(2026, 10, 5));
  assert.equal(p.expression, 7);
  assert.equal(p.soulUrge, 2);
  assert.equal(p.personality, 5);
  assert.equal(p.age, 36);
  assert.equal(p.nextPersonalYear.year, 2027);
});

test("valida data", () => {
  assert.equal(validBirthDate({ day: 31, month: 2, year: 1990 }), false);
  assert.equal(validBirthDate({ day: 29, month: 2, year: 2000 }), true);
  assert.equal(validBirthDate({ day: 1, month: 1, year: 2999 }), false);
});
