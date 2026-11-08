// Geometria pura da roda do mapa astral. Sem import de natal.ts em runtime (astronomy-engine nao pode ir ao cliente).
const TEXT = "︎"; // força glifo de texto (não emoji) no iOS/Android

export const SIGN_GLYPHS: string[] = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"].map((g) => g + TEXT);

export const PLANET_GLYPHS: Record<string, string> = {
  "Sol": "☉" + TEXT, "Lua": "☽" + TEXT, "Mercúrio": "☿" + TEXT, "Vênus": "♀" + TEXT, "Marte": "♂" + TEXT,
  "Júpiter": "♃" + TEXT, "Saturno": "♄" + TEXT, "Urano": "♅" + TEXT, "Netuno": "♆" + TEXT, "Plutão": "♇" + TEXT,
  "Nodo Norte": "☊" + TEXT, "Lilith": "⚸" + TEXT, "Parte da Fortuna": "⊗" + TEXT,
};

export const ASPECT_COLORS: Record<string, string> = {
  "Conjunção": "#a8823c",
  "Oposição": "#c0392b",
  "Quadratura": "#d4682a",
  "Trígono": "#2f6fa8",
  "Sextil": "#3d8b5a",
};

/** Ascendente a esquerda (9h); longitude cresce no sentido anti-horario. */
export function lonToXY(lon: number, r: number, ascLon: number, cx = 200, cy = 200): { x: number; y: number } {
  const t = ((180 + lon - ascLon) * Math.PI) / 180;
  return { x: cx + r * Math.cos(t), y: cy - r * Math.sin(t) };
}

export function spreadPlanets(
  points: { name: string; lon: number }[],
  minSep = 7,
): { name: string; lon: number; display: number }[] {
  const n = points.length;
  if (n === 0) return [];
  const sep = n * minSep > 360 ? 360 / n : minSep;
  const sorted = points
    .map((p) => ({ name: p.name, lon: ((p.lon % 360) + 360) % 360 }))
    .sort((a, b) => a.lon - b.lon);
  const d = sorted.map((p) => p.lon);
  if (n > 1) {
    for (let iter = 0; iter < 2000; iter++) {
      let moved = false;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const gap = j === 0 ? d[0] + 360 - d[i] : d[j] - d[i];
        if (gap < sep - 1e-9) {
          const push = (sep - gap) / 2;
          d[i] -= push;
          d[j] += push;
          moved = true;
        }
      }
      if (!moved) break;
    }
  }
  return sorted.map((p, i) => ({ name: p.name, lon: p.lon, display: ((d[i] % 360) + 360) % 360 }));
}
