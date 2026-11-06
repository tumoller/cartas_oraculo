import { test } from "node:test";
import assert from "node:assert/strict";
import * as A from "astronomy-engine";
import { natalChart, localToUtc, ascendant, placidusCusps, houseOf, placement } from "../src/lib/natal.ts";

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
  assert.deepEqual(placement(45.5), { sign: "Touro", degree: 15, minute: 30, longitude: 45.5 });
});
