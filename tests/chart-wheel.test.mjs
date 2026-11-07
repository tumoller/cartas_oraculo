import test from "node:test";
import assert from "node:assert/strict";
import { lonToXY, spreadPlanets, SIGN_GLYPHS, PLANET_GLYPHS } from "../src/lib/chart-wheel.ts";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("lonToXY: Ascendente a esquerda, anti-horario", () => {
  const asc = 123.4;
  let p = lonToXY(asc, 195, asc);
  near(p.x, 5); near(p.y, 200);
  p = lonToXY(asc + 90, 195, asc);
  near(p.x, 200); near(p.y, 395);
  p = lonToXY(asc + 180, 195, asc);
  near(p.x, 395); near(p.y, 200);
  p = lonToXY(asc + 270, 195, asc);
  near(p.x, 200); near(p.y, 5);
});

test("glifos: 12 signos e planetas com seletor de texto", () => {
  assert.equal(SIGN_GLYPHS.length, 12);
  assert.ok(SIGN_GLYPHS.every((g) => g.endsWith("︎")));
  assert.ok(Object.values(PLANET_GLYPHS).every((g) => g.endsWith("︎")));
  assert.equal(Object.keys(PLANET_GLYPHS).length, 13);
});

const circ = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

test("spreadPlanets: pontos distantes nao se movem", () => {
  const r = spreadPlanets([{ name: "a", lon: 10 }, { name: "b", lon: 100 }, { name: "c", lon: 250 }]);
  for (const p of r) near(p.display, p.lon);
});

test("spreadPlanets: dois pontos a 2 graus separam", () => {
  const r = spreadPlanets([{ name: "a", lon: 100 }, { name: "b", lon: 102 }], 7);
  assert.ok(circ(r[0].display, r[1].display) >= 7 - 0.01);
});

test("spreadPlanets: cruza 0/360", () => {
  const r = spreadPlanets([{ name: "a", lon: 359 }, { name: "b", lon: 1 }], 7);
  assert.ok(circ(r[0].display, r[1].display) >= 7 - 0.01);
  for (const p of r) assert.ok(p.display >= 0 && p.display < 360);
});

test("spreadPlanets: 15 pontos amontoados terminam separados", () => {
  const pts = Array.from({ length: 15 }, (_, i) => ({ name: "p" + i, lon: 100 + i * 0.3 }));
  const r = spreadPlanets(pts, 7);
  assert.equal(r.length, 15);
  const d = r.map((p) => p.display).sort((a, b) => a - b);
  for (const v of d) assert.ok(v >= 0 && v < 360);
  const need = Math.min(7, 360 / 15) - 0.5;
  for (let i = 0; i < d.length; i++) {
    const next = i === d.length - 1 ? d[0] + 360 : d[i + 1];
    assert.ok(next - d[i] >= need, `gap ${next - d[i]} < ${need}`);
  }
});
