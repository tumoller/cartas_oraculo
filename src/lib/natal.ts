// Mapa natal: zodíaco tropical, casas Placidus, efemérides da astronomy-engine (MIT).
// Cálculo determinístico; a IA só interpreta o JSON resultante.
import * as A from "astronomy-engine";

export const SIGNS = ["Áries", "Touro", "Gêmeos", "Câncer", "Leão", "Virgem", "Libra", "Escorpião", "Sagitário", "Capricórnio", "Aquário", "Peixes"] as const;
const ELEMENT = ["Fogo", "Terra", "Ar", "Água"] as const;
const MODALITY = ["Cardinal", "Fixo", "Mutável"] as const;

const PLANETS = [
  ["Sol", A.Body.Sun], ["Lua", A.Body.Moon], ["Mercúrio", A.Body.Mercury], ["Vênus", A.Body.Venus], ["Marte", A.Body.Mars],
  ["Júpiter", A.Body.Jupiter], ["Saturno", A.Body.Saturn], ["Urano", A.Body.Uranus], ["Netuno", A.Body.Neptune], ["Plutão", A.Body.Pluto],
] as const;

const ASPECTS = [
  { name: "Conjunção", angle: 0, orb: 8 }, { name: "Oposição", angle: 180, orb: 8 }, { name: "Trígono", angle: 120, orb: 7 },
  { name: "Quadratura", angle: 90, orb: 7 }, { name: "Sextil", angle: 60, orb: 5 },
] as const;

const rad = Math.PI / 180;
const norm360 = (x: number) => ((x % 360) + 360) % 360;
const sin = (d: number) => Math.sin(d * rad), cos = (d: number) => Math.cos(d * rad), tan = (d: number) => Math.tan(d * rad);
const atan2 = (y: number, x: number) => norm360(Math.atan2(y, x) / rad);

export type Dignity = "Domicílio" | "Exaltação" | "Exílio" | "Queda";
export type Placement = { sign: string; degree: number; minute: number; longitude: number; decan: 1 | 2 | 3; house?: number; retrograde?: boolean; dignities?: Dignity[] };
export type Aspect = { a: string; b: string; type: string; orb: number };
export type NatalInput = {
  date: { day: number; month: number; year: number };
  time?: { hour: number; minute: number }; // ausente = mapa simples (sem Ascendente/casas)
  place: { lat: number; lon: number; timeZone: string };
};
export type NatalChart = {
  mode: "completo" | "simples";
  utc: string;
  utcOffset: string;
  timeNote?: string;            // ex.: hora ambígua no fim do horário de verão
  planets: Record<string, Placement>;
  ascendant?: Placement;
  midheaven?: Placement;
  houses?: number[];            // 12 cúspides (longitude)
  northNode: Placement;         // nodo médio
  moonUncertain?: string[];     // mapa simples: Lua troca de signo no dia
  aspects: Aspect[];
  elements: Record<string, number>;   // contagem simples dos 10 planetas
  modalities: Record<string, number>;
  lilith: Placement;            // Lua Negra média (apogeu lunar médio)
  sect?: "diurno" | "noturno";  // mapa completo: Sol acima (casas 7-12) ou abaixo do horizonte
  fortune?: Placement;          // Parte da Fortuna (mapa completo)
  elementsWeighted: Record<string, number>; // % com os pesos de ELEMENT_WEIGHTS
  polarity: { Yang: number; Yin: number };  // % ponderada: Yang = Fogo + Ar, Yin = Terra + Água
};

export function placement(longitude: number): Placement {
  const lon = norm360(longitude);
  const inSign = lon % 30;
  return {
    sign: SIGNS[Math.floor(lon / 30)], degree: Math.floor(inSign), minute: Math.floor((inSign % 1) * 60),
    longitude: Math.round(lon * 1e4) / 1e4, decan: (Math.floor(inSign / 10) + 1) as 1 | 2 | 3,
  };
}

// ---------- dignidades ----------
// Domicílios tradicionais (Ptolomeu, Tetrabiblos I.17) + regentes modernos dos transpessoais
// (Urano/Aquário, Netuno/Peixes, Plutão/Escorpião). Exaltações só dos 7 tradicionais (Tetrabiblos I.19);
// as dos transpessoais não têm consenso e ficam de fora. Exílio = signo oposto ao domicílio; queda = oposto à exaltação.
const DOMICILE: Record<string, string[]> = {
  Sol: ["Leão"], Lua: ["Câncer"], Mercúrio: ["Gêmeos", "Virgem"], Vênus: ["Touro", "Libra"], Marte: ["Áries", "Escorpião"],
  Júpiter: ["Sagitário", "Peixes"], Saturno: ["Capricórnio", "Aquário"], Urano: ["Aquário"], Netuno: ["Peixes"], Plutão: ["Escorpião"],
};
const EXALTATION: Record<string, string> = {
  Sol: "Áries", Lua: "Touro", Mercúrio: "Virgem", Vênus: "Peixes", Marte: "Capricórnio", Júpiter: "Câncer", Saturno: "Libra",
};
const opposite = (sign: string) => SIGNS[(SIGNS.indexOf(sign as (typeof SIGNS)[number]) + 6) % 12];

export function dignitiesOf(planet: string, sign: string): Dignity[] {
  const out: Dignity[] = [];
  const dom = DOMICILE[planet] ?? [], exa = EXALTATION[planet];
  if (dom.includes(sign)) out.push("Domicílio");
  if (exa === sign) out.push("Exaltação");
  if (dom.some((d) => opposite(d) === sign)) out.push("Exílio");
  if (exa && opposite(exa) === sign) out.push("Queda");
  return out;
}

// ---------- elementos ponderados ----------
// Pesos PRÓPRIOS deste projeto (não são os do Astrolink, que não publica os dele): os pontos pessoais
// pesam mais, os planetas sociais menos e os geracionais quase nada. Ascendente só no mapa completo.
export const ELEMENT_WEIGHTS: Record<string, number> = {
  Sol: 3, Lua: 3, Ascendente: 3, Mercúrio: 2, Vênus: 2, Marte: 2, Júpiter: 1, Saturno: 1, Urano: 0.5, Netuno: 0.5, Plutão: 0.5,
};

/** Arredonda porcentagens para inteiros que somam 100 (maiores restos). */
export function percentages<K extends string>(values: Record<K, number>): Record<K, number> {
  const keys = Object.keys(values) as K[], total = keys.reduce((a, k) => a + values[k], 0);
  if (!total) return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  const raw = keys.map((k) => (values[k] / total) * 100), out = raw.map(Math.floor);
  const order = raw.map((r, i) => [r - out[i], i] as const).sort((a, b) => b[0] - a[0]);
  const missing = 100 - out.reduce((a, b) => a + b, 0);
  for (let i = 0; i < missing; i++) out[order[i][1]]++;
  return Object.fromEntries(keys.map((k, i) => [k, out[i]])) as Record<K, number>;
}

// ---------- tempo ----------
function offsetMinutes(timeZone: string, utcMs: number): number {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(new Date(utcMs)).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = part.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
}

/** Hora local de nascimento (IANA, com histórico de horário de verão) → UTC. */
export function localToUtc(date: NatalInput["date"], hour: number, minute: number, timeZone: string): { utcMs: number; offset: number; note?: string } {
  const wall = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  const candidates = new Set<number>();
  for (const probe of [wall - 36e5 * 3, wall, wall + 36e5 * 3]) candidates.add(offsetMinutes(timeZone, probe));
  const valid = [...candidates].map((off) => wall - off * 6e4).filter((utc) => wall - offsetMinutes(timeZone, utc) * 6e4 === utc).sort((x, y) => x - y);
  if (valid.length === 0) { // hora "pulada" no início do horário de verão
    const off = offsetMinutes(timeZone, wall - 36e5 * 3);
    return { utcMs: wall - off * 6e4, offset: off, note: "Horário inexistente (início do horário de verão); usado o fuso anterior." };
  }
  const utcMs = valid[0];
  return { utcMs, offset: offsetMinutes(timeZone, utcMs), note: valid.length > 1 ? "Horário ambíguo (fim do horário de verão); usada a primeira ocorrência." : undefined };
}

const fmtOffset = (min: number) => `UTC${min < 0 ? "-" : "+"}${String(Math.floor(Math.abs(min) / 60)).padStart(2, "0")}:${String(Math.abs(min) % 60).padStart(2, "0")}`;

// ---------- posições ----------
function eclipticLongitude(body: A.Body, time: A.AstroTime): number {
  const ect = A.RotateVector(A.Rotation_EQJ_ECT(time), A.GeoVector(body, time, true));
  return norm360(A.SphereFromVector(ect).lon);
}

function meanNode(time: A.AstroTime): number {
  const T = time.tt / 36525;
  return norm360(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T);
}

/** Lilith média = perigeu lunar médio + 180° (Meeus, Astronomical Algorithms, 2ª ed., eq. 47.7). T em séculos julianos TT desde J2000. */
export function meanLilith(T: number): number {
  const perigee = 83.3532465 + 4069.0137287 * T - 0.01032 * T * T - (T * T * T) / 80053 + (T * T * T * T) / 18999000;
  return norm360(perigee + 180);
}

/** Parte da Fortuna: de dia Asc + Lua − Sol; de noite Asc + Sol − Lua. */
export function partOfFortune(asc: number, sun: number, moon: number, sect: "diurno" | "noturno"): number {
  return norm360(sect === "diurno" ? asc + moon - sun : asc + sun - moon);
}

// ---------- ângulos e casas ----------
type Frame = { ramc: number; eps: number; lat: number };

export function ascendant({ ramc, eps, lat }: Frame): number {
  return atan2(cos(ramc), -(sin(ramc) * cos(eps) + tan(lat) * sin(eps)));
}
export function midheaven({ ramc, eps }: Frame): number {
  return atan2(sin(ramc), cos(ramc) * cos(eps));
}

/** Ângulo horário de um ponto da eclíptica (negativo = leste), em (-270, 90]. */
function hourAngleAndSemiArc(lambda: number, { ramc, eps, lat }: Frame) {
  const ra = atan2(sin(lambda) * cos(eps), cos(lambda));
  const dec = Math.asin(sin(eps) * sin(lambda)) / rad;
  const ha = norm360(ramc - ra + 270) - 270;
  const dsa = Math.acos(Math.max(-1, Math.min(1, -tan(lat) * tan(dec)))) / rad;
  return { ha, dsa };
}

/** Cúspides Placidus por busca numérica entre o MC e o IC (lado leste). */
export function placidusCusps(frame: Frame): number[] {
  const mc = midheaven(frame);
  const targets: Array<[number, (dsa: number) => number]> = [
    [11, (d) => -d / 3], [12, (d) => (-2 * d) / 3], [1, (d) => -d],
    [2, (d) => -(d + (180 - d) / 3)], [3, (d) => -(d + (2 * (180 - d)) / 3)],
  ];
  const cusps: number[] = new Array(13);
  cusps[10] = mc; cusps[4] = norm360(mc + 180);
  for (const [house, target] of targets) {
    const f = (offset: number) => { const p = hourAngleAndSemiArc(mc + offset, frame); return p.ha - target(p.dsa); };
    const lo = 0.0001; let flo = f(lo), found = NaN;
    for (let step = 0.5; step <= 180; step += 0.5) {
      const fhi = f(step);
      if (Math.sign(fhi) !== Math.sign(flo)) {
        let a = step - 0.5 < lo ? lo : step - 0.5, b = step;
        for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (Math.sign(f(m)) === Math.sign(f(a))) a = m; else b = m; }
        found = (a + b) / 2; break;
      }
      flo = fhi;
    }
    cusps[house] = norm360(mc + found);
  }
  for (const h of [11, 12, 1, 2, 3]) cusps[((h + 5) % 12) + 1] = norm360(cusps[h] + 180);
  return cusps.slice(1); // índice 0 = casa 1
}

export function houseOf(longitude: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) {
    const start = cusps[i], span = norm360(cusps[(i + 1) % 12] - start);
    if (norm360(longitude - start) < span) return i + 1;
  }
  return 12;
}

function aspectsBetween(points: Array<[string, number]>): Aspect[] {
  const out: Aspect[] = [];
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    const [a, la] = points[i], [b, lb] = points[j];
    const sep = Math.abs(((la - lb + 540) % 360) - 180); // separação angular, 0..180
    const bonus = [a, b].some((n) => n === "Sol" || n === "Lua") ? 2 : 0;
    for (const asp of ASPECTS) {
      const orb = Math.abs(sep - asp.angle);
      if (orb <= asp.orb + bonus) { out.push({ a, b, type: asp.name, orb: Math.round(orb * 10) / 10 }); break; }
    }
  }
  return out.sort((x, y) => x.orb - y.orb);
}

export function natalChart(input: NatalInput): NatalChart {
  const { date, time, place } = input;
  const full = Boolean(time);
  const conv = localToUtc(date, time?.hour ?? 12, time?.minute ?? 0, place.timeZone);
  const t = A.MakeTime(new Date(conv.utcMs));
  const day = 864e5;

  const planets: Record<string, Placement> = {};
  for (const [name, body] of PLANETS) {
    const lon = eclipticLongitude(body, t);
    const p = placement(lon);
    if (name !== "Sol" && name !== "Lua") {
      const before = eclipticLongitude(body, A.MakeTime(new Date(conv.utcMs - day / 2)));
      const after = eclipticLongitude(body, A.MakeTime(new Date(conv.utcMs + day / 2)));
      p.retrograde = ((after - before + 540) % 360) - 180 < 0;
    }
    planets[name] = p;
  }

  const chart: NatalChart = {
    mode: full ? "completo" : "simples",
    utc: new Date(conv.utcMs).toISOString(),
    utcOffset: fmtOffset(conv.offset),
    timeNote: conv.note,
    planets,
    northNode: placement(meanNode(t)),
    aspects: aspectsBetween(PLANETS.map(([n]) => [n, planets[n].longitude])),
    elements: Object.fromEntries(ELEMENT.map((e) => [e, 0])),
    modalities: Object.fromEntries(MODALITY.map((m) => [m, 0])),
    lilith: placement(meanLilith(t.tt / 36525)),
    elementsWeighted: {},
    polarity: { Yang: 0, Yin: 0 },
  };
  for (const [name] of PLANETS) {
    const d = dignitiesOf(name, planets[name].sign);
    if (d.length) planets[name].dignities = d;
  }

  for (const [name] of PLANETS) {
    const idx = SIGNS.indexOf(planets[name].sign as (typeof SIGNS)[number]);
    chart.elements[ELEMENT[idx % 4]]++;
    chart.modalities[MODALITY[idx % 3]]++;
  }

  if (full) {
    const frame: Frame = { ramc: norm360(A.SiderealTime(t) * 15 + place.lon), eps: A.e_tilt(t).tobl, lat: place.lat };
    const cusps = placidusCusps(frame);
    chart.houses = cusps.map((c) => Math.round(c * 1e4) / 1e4);
    chart.ascendant = placement(cusps[0]);
    chart.midheaven = placement(cusps[9]);
    for (const [name] of PLANETS) planets[name].house = houseOf(planets[name].longitude, cusps);
    chart.northNode.house = houseOf(chart.northNode.longitude, cusps);
    chart.lilith.house = houseOf(chart.lilith.longitude, cusps);
    // Sol nas casas 7 a 12 = acima do horizonte (a cúspide 1 é o Ascendente e a 7 o Descendente).
    chart.sect = (planets["Sol"].house ?? 1) >= 7 ? "diurno" : "noturno";
    chart.fortune = placement(partOfFortune(cusps[0], planets["Sol"].longitude, planets["Lua"].longitude, chart.sect));
    chart.fortune.house = houseOf(chart.fortune.longitude, cusps);
  } else {
    const start = localToUtc(date, 0, 0, place.timeZone).utcMs, end = localToUtc(date, 23, 59, place.timeZone).utcMs;
    const a = placement(eclipticLongitude(A.Body.Moon, A.MakeTime(new Date(start)))).sign;
    const b = placement(eclipticLongitude(A.Body.Moon, A.MakeTime(new Date(end)))).sign;
    if (a !== b) chart.moonUncertain = [a, b];
  }

  const weighted: Record<string, number> = Object.fromEntries(ELEMENT.map((e) => [e, 0]));
  const signs: Array<[string, string]> = PLANETS.map(([n]) => [n, planets[n].sign]);
  if (chart.ascendant) signs.push(["Ascendente", chart.ascendant.sign]);
  for (const [name, sign] of signs) weighted[ELEMENT[SIGNS.indexOf(sign as (typeof SIGNS)[number]) % 4]] += ELEMENT_WEIGHTS[name];
  chart.elementsWeighted = percentages(weighted);
  chart.polarity = percentages({ Yang: weighted["Fogo"] + weighted["Ar"], Yin: weighted["Terra"] + weighted["Água"] });
  return chart;
}
