import { test } from "node:test";
import assert from "node:assert/strict";
import * as A from "astronomy-engine";
import { readFileSync } from "node:fs";
import { natalChart, localToUtc, ascendant, placidusCusps, houseOf, placement, dignitiesOf, meanLilith, partOfFortune, percentages, ELEMENT_WEIGHTS } from "../src/lib/natal.ts";

const diff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

test("Sol no equinócio de março de 2024 está em 0° de Áries", () => {
  const c = natalChart({ date: { day: 20, month: 3, year: 2024 }, place: { lat: 0, lon: 0, timeZone: "UTC" }, time: { hour: 3, minute: 6 } });
  assert.ok(diff(c.planets["Sol"].longitude, 0) < 0.05, String(c.planets["Sol"].longitude));
});

test("horário de verão histórico de São Paulo (jan/1995 = UTC-2)", () => {
  const r = localToUtc({ day: 15, month: 1, year: 1995 }, 10, 0, "America/Sao_Paulo");
  assert.equal(new Date(r.utcMs).toISOString(), "1995-01-15T12:00:00.000Z");
  const r2 = localToUtc({ day: 15, month: 1, year: 2010 }, 10, 0, "America/Recife");
  assert.equal(new Date(r2.utcMs).toISOString(), "2010-01-15T13:00:00.000Z");
});

test("Placidus: cúspide 1 bate com a fórmula do Ascendente e as casas avançam em ordem", () => {
  for (const [ramc, lat] of [[0, -23.55], [77, -23.55], [200, -30], [310, 3], [145, -15.8]]) {
    const frame = { ramc, eps: 23.44, lat };
    const cusps = placidusCusps(frame);
    assert.ok(diff(cusps[0], ascendant(frame)) < 0.01, `asc ramc=${ramc}`);
    let total = 0;
    for (let i = 0; i < 12; i++) { const span = (cusps[(i + 1) % 12] - cusps[i] + 360) % 360; assert.ok(span > 5 && span < 60, `casa ${i + 1} span ${span}`); total += span; }
    assert.ok(Math.abs(total - 360) < 1e-6);
  }
});

test("mapa completo e simples", () => {
  const input = { date: { day: 15, month: 7, year: 1990 }, place: { lat: -23.5505, lon: -46.6333, timeZone: "America/Sao_Paulo" } };
  const full = natalChart({ ...input, time: { hour: 14, minute: 30 } });
  assert.equal(full.mode, "completo");
  assert.equal(full.planets["Sol"].sign, "Câncer");
  assert.ok(full.ascendant && full.houses.length === 12);
  assert.equal(full.planets["Sol"].house, houseOf(full.planets["Sol"].longitude, full.houses));
  const simple = natalChart(input);
  assert.equal(simple.mode, "simples");
  assert.equal(simple.ascendant, undefined);
  assert.equal(simple.planets["Sol"].house, undefined);
});

test("placement formata signo e grau", () => {
  assert.deepEqual(placement(45.5), { sign: "Touro", degree: 15, minute: 30, longitude: 45.5, decan: 2 });
});

// ---------- Caso de referência: Arthur (conferido grau a grau no Astrolink) ----------
// 01/03/1991, 21h45, São Paulo-SP. Coordenadas da própria base de municípios usada em produção.
const [, , spLat, spLon] = JSON.parse(readFileSync(new URL("../src/data/municipios.json", import.meta.url), "utf8")).find((r) => r[0] === "São Paulo" && r[1] === "SP");
const arthur = natalChart({ date: { day: 1, month: 3, year: 1991 }, time: { hour: 21, minute: 45 }, place: { lat: spLat, lon: spLon, timeZone: "America/Sao_Paulo" } });
const at = (p) => `${p.sign} ${p.degree}`;

test("Arthur: Sol, Lua, Ascendente e MC batem com o Astrolink", () => {
  assert.equal(arthur.utc, "1991-03-02T00:45:00.000Z"); // UTC-3: o horário de verão 1990/91 de SP terminou em 17/02/1991
  assert.equal(at(arthur.planets["Sol"]), "Peixes 10");
  assert.equal(at(arthur.planets["Lua"]), "Virgem 27");
  assert.equal(at(arthur.ascendant), "Escorpião 13");
  assert.equal(at(arthur.midheaven), "Leão 1");
});

test("Arthur: Lilith média e Parte da Fortuna batem com o Astrolink", () => {
  assert.equal(at(arthur.lilith), "Sagitário 23");
  assert.equal(arthur.sect, "noturno"); // Sol na casa 5, abaixo do horizonte
  assert.equal(arthur.planets["Sol"].house, 5);
  assert.equal(at(arthur.fortune), "Áries 27");
});

test("Arthur: decanato, dignidades, elementos e polaridade", () => {
  assert.equal(arthur.planets["Sol"].decan, 2);  // 10°55' de Peixes
  assert.equal(arthur.planets["Lua"].decan, 3);  // 27° de Virgem
  for (const [name, p] of Object.entries(arthur.planets)) assert.deepEqual(p.dignities ?? [], dignitiesOf(name, p.sign), name);
  assert.equal(arthur.planets["Sol"].dignities, undefined); // Sol em Peixes: peregrino
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  assert.equal(sum(arthur.elementsWeighted), 100);
  assert.equal(sum(arthur.polarity), 100);
  assert.ok(Math.abs(arthur.polarity.Yang - (arthur.elementsWeighted["Fogo"] + arthur.elementsWeighted["Ar"])) <= 1); // só arredondamento
});

test("dignidades: tabela de Ptolomeu + regentes modernos", () => {
  assert.deepEqual(dignitiesOf("Sol", "Leão"), ["Domicílio"]);
  assert.deepEqual(dignitiesOf("Sol", "Áries"), ["Exaltação"]);
  assert.deepEqual(dignitiesOf("Sol", "Aquário"), ["Exílio"]);
  assert.deepEqual(dignitiesOf("Sol", "Libra"), ["Queda"]);
  assert.deepEqual(dignitiesOf("Mercúrio", "Virgem"), ["Domicílio", "Exaltação"]);
  assert.deepEqual(dignitiesOf("Mercúrio", "Peixes"), ["Exílio", "Queda"]);
  assert.deepEqual(dignitiesOf("Marte", "Touro"), ["Exílio"]);
  assert.deepEqual(dignitiesOf("Marte", "Câncer"), ["Queda"]);
  assert.deepEqual(dignitiesOf("Vênus", "Virgem"), ["Queda"]);
  assert.deepEqual(dignitiesOf("Saturno", "Câncer"), ["Exílio"]);
  assert.deepEqual(dignitiesOf("Plutão", "Escorpião"), ["Domicílio"]);
  assert.deepEqual(dignitiesOf("Netuno", "Virgem"), ["Exílio"]);
  assert.deepEqual(dignitiesOf("Urano", "Escorpião"), []); // exaltação dos transpessoais fica de fora
  // Cada planeta tradicional tem exatamente 1 exaltação e 1 queda nos 12 signos.
  const signs = ["Áries", "Touro", "Gêmeos", "Câncer", "Leão", "Virgem", "Libra", "Escorpião", "Sagitário", "Capricórnio", "Aquário", "Peixes"];
  for (const pl of ["Sol", "Lua", "Mercúrio", "Vênus", "Marte", "Júpiter", "Saturno"]) {
    assert.equal(signs.filter((sg) => dignitiesOf(pl, sg).includes("Exaltação")).length, 1, pl);
    assert.equal(signs.filter((sg) => dignitiesOf(pl, sg).includes("Queda")).length, 1, pl);
  }
});

test("Lilith média: constante de Meeus em J2000 e período de ~8,85 anos", () => {
  assert.ok(Math.abs(meanLilith(0) - 263.3532465) < 1e-9);
  const period = 360 / 4069.0137287 * 100; // anos
  assert.ok(Math.abs(period - 8.847) < 0.01);
  assert.ok(diff(meanLilith(period / 100), meanLilith(0)) < 0.01);
});

test("Parte da Fortuna: fórmula diurna e noturna", () => {
  assert.equal(partOfFortune(100, 10, 50, "diurno"), 140);   // Asc + Lua − Sol
  assert.equal(partOfFortune(100, 10, 50, "noturno"), 60);   // Asc + Sol − Lua
  assert.equal(partOfFortune(350, 20, 0, "diurno"), 330);    // normaliza para 0..360
});

test("decanato pelo grau no signo", () => {
  assert.equal(placement(0).decan, 1);
  assert.equal(placement(9.99).decan, 1);
  assert.equal(placement(10).decan, 2);
  assert.equal(placement(29.99).decan, 3);
});

test("porcentagens somam 100 e pesos documentados", () => {
  assert.deepEqual(percentages({ a: 1, b: 1, c: 1 }), { a: 34, b: 33, c: 33 });
  assert.deepEqual(percentages({ a: 0, b: 0 }), { a: 0, b: 0 });
  assert.equal(ELEMENT_WEIGHTS["Sol"], 3);
  const simple = natalChart({ date: { day: 1, month: 3, year: 1991 }, place: { lat: spLat, lon: spLon, timeZone: "America/Sao_Paulo" } });
  assert.equal(simple.fortune, undefined); // sem hora não há Fortuna nem seita
  assert.equal(simple.sect, undefined);
  assert.ok(simple.lilith); // Lilith não depende da hora (no dia, varia ~0,1°)
  assert.equal(Object.values(simple.elementsWeighted).reduce((a, b) => a + b, 0), 100);
});

test("aspectos usam a separação real (regressão: V1 invertia conjunção/oposição e trígono/sextil)", () => {
  const find = (a, b) => arthur.aspects.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  assert.equal(find("Sol", "Mercúrio").type, "Conjunção");   // 340,93° x 340,86°
  assert.equal(find("Júpiter", "Saturno").type, "Oposição"); // 124,83° x 302,54° = 177,7°
  assert.equal(find("Sol", "Urano").type, "Sextil");         // 340,93° x 282,88° = 58,1°
  assert.equal(find("Sol", "Marte").type, "Quadratura");     // 340,93° x 74,15° = 93,2°
  for (const x of arthur.aspects) {
    const sep = diff(arthur.planets[x.a].longitude, arthur.planets[x.b].longitude);
    const angle = { "Conjunção": 0, "Sextil": 60, "Quadratura": 90, "Trígono": 120, "Oposição": 180 }[x.type];
    assert.ok(Math.abs(Math.abs(sep - angle) - x.orb) < 0.06, `${x.a}-${x.b}`);
  }
});
