import type { NatalChart, Placement } from "@/lib/natal";
import { ASPECT_COLORS, PLANET_GLYPHS, SIGN_GLYPHS, lonToXY, spreadPlanets } from "@/lib/chart-wheel";

const ORDER = ["Sol", "Lua", "Mercúrio", "Vênus", "Marte", "Júpiter", "Saturno", "Urano", "Netuno", "Plutão"];
const r2 = (n: number) => Math.round(n * 100) / 100;

export default function ChartWheel({ chart, size }: { chart: NatalChart; size?: number }) {
  const asc = chart.ascendant?.longitude ?? 0;
  const P = (lon: number, r: number) => {
    const { x, y } = lonToXY(lon, r, asc);
    return { x: r2(x), y: r2(y) };
  };

  const pts: { name: string; p: Placement }[] = [];
  for (const name of ORDER) if (chart.planets?.[name]) pts.push({ name, p: chart.planets[name] });
  if (chart.northNode) pts.push({ name: "Nodo Norte", p: chart.northNode });
  const lilith = chart.lilith as Placement | undefined;
  const fortune = chart.fortune as Placement | undefined;
  if (lilith) pts.push({ name: "Lilith", p: lilith });
  if (fortune) pts.push({ name: "Parte da Fortuna", p: fortune });
  const byName = new Map(pts.map((x) => [x.name, x.p]));
  const spread = spreadPlanets(pts.map((x) => ({ name: x.name, lon: x.p.longitude })));

  const sunSign = chart.planets?.Sol?.sign ?? "?";
  const moonSign = chart.planets?.Lua?.sign ?? "?";
  const label = `Roda do mapa astral: ${chart.ascendant ? `Ascendente em ${chart.ascendant.sign}, ` : ""}Sol em ${sunSign}, Lua em ${moonSign}`;

  const ticks = [];
  for (let d = 0; d < 360; d += 5) {
    const len = d % 10 === 0 ? 6 : 3;
    const a = P(d, 165), b = P(d, 165 + len);
    ticks.push(<line key={d} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" strokeOpacity={0.35} strokeWidth={0.6} />);
  }

  const slices = [];
  for (let i = 0; i < 12; i++) {
    const a0 = i * 30, a1 = a0 + 30;
    const o0 = P(a0, 195), o1 = P(a1, 195), i0 = P(a0, 165), i1 = P(a1, 165);
    // longitude anti-horaria => sweep-flag 0 no sistema SVG (y para baixo)
    const d = `M${o0.x} ${o0.y} A195 195 0 0 0 ${o1.x} ${o1.y} L${i1.x} ${i1.y} A165 165 0 0 1 ${i0.x} ${i0.y} Z`;
    const g = P(a0 + 15, 180);
    slices.push(
      <g key={i}>
        <path d={d} fill="currentColor" fillOpacity={i % 2 ? 0.06 : 0.02} stroke="currentColor" strokeOpacity={0.3} strokeWidth={0.6} />
        <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize={16} fill="currentColor" fillOpacity={0.85}>{SIGN_GLYPHS[i]}</text>
      </g>,
    );
  }

  const houses = chart.houses && chart.houses.length === 12 ? chart.houses : null;
  const houseEls = houses?.map((cusp, i) => {
    const angular = i % 3 === 0;
    const a = P(cusp, 95), b = P(cusp, angular ? 195 : 165);
    const next = houses[(i + 1) % 12];
    const span = (((next - cusp) % 360) + 360) % 360;
    const n = P(cusp + span / 2, 105);
    const tag = i === 0 ? "ASC" : i === 9 ? "MC" : null;
    const t = tag ? P(cusp, 189) : null;
    return (
      <g key={i}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" strokeOpacity={angular ? 0.8 : 0.35} strokeWidth={angular ? 1.6 : 0.7} />
        <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" fontSize={9} fill="currentColor" fillOpacity={0.4}>{i + 1}</text>
        {tag && t && <text x={t.x} y={t.y} textAnchor="middle" dominantBaseline="central" fontSize={7} fill="currentColor" fillOpacity={0.9}>{tag}</text>}
      </g>
    );
  });

  const aspectEls = (chart.aspects ?? []).map((asp, i) => {
    if (asp.type === "Conjunção") return null;
    const pa = byName.get(asp.a), pb = byName.get(asp.b);
    if (!pa || !pb) return null;
    const a = P(pa.longitude, 95), b = P(pb.longitude, 95);
    return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ASPECT_COLORS[asp.type] ?? "currentColor"} strokeOpacity={0.7} strokeWidth={1} />;
  });

  const planetEls = spread.map((s) => {
    const pl = byName.get(s.name)!;
    const real = P(s.lon, 165), tickEnd = P(s.display, 158);
    const g = P(s.display, 145), deg = P(s.display, 128);
    return (
      <g key={s.name}>
        <line x1={real.x} y1={real.y} x2={tickEnd.x} y2={tickEnd.y} stroke="currentColor" strokeOpacity={0.5} strokeWidth={0.6} />
        <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize={17} fill="currentColor">{PLANET_GLYPHS[s.name] ?? s.name[0]}</text>
        <text x={deg.x} y={deg.y} textAnchor="middle" dominantBaseline="central" fontSize={9} fill="currentColor" fillOpacity={0.75}>{`${pl.degree}°${pl.retrograde ? "℞" : ""}`}</text>
      </g>
    );
  });

  return (
    <svg
      viewBox="0 0 400 400"
      width={size ?? "100%"}
      style={{ maxWidth: 420, display: "block", margin: "0 auto" }}
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx={200} cy={200} r={195} fill="none" stroke="currentColor" strokeOpacity={0.5} strokeWidth={1} />
      {slices}
      {ticks}
      <circle cx={200} cy={200} r={95} fill="none" stroke="currentColor" strokeOpacity={0.35} strokeWidth={0.8} />
      {houseEls}
      {aspectEls}
      {planetEls}
    </svg>
  );
}
