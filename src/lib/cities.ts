// Municípios do IBGE (base kelvins/municipios-brasileiros, MIT) com fuso IANA por UF.
// O fuso por UF preserva o histórico de horário de verão de cada região (o Nordeste e MT/MS diferem de SP).
import rows from "@/data/municipios.json";

const UF_ZONE: Record<string, string> = {
  AC: "America/Rio_Branco", AL: "America/Maceio", AP: "America/Belem", AM: "America/Manaus", BA: "America/Bahia",
  CE: "America/Fortaleza", DF: "America/Sao_Paulo", ES: "America/Sao_Paulo", GO: "America/Sao_Paulo", MA: "America/Fortaleza",
  MT: "America/Cuiaba", MS: "America/Campo_Grande", MG: "America/Sao_Paulo", PA: "America/Belem", PB: "America/Fortaleza",
  PR: "America/Sao_Paulo", PE: "America/Recife", PI: "America/Fortaleza", RJ: "America/Sao_Paulo", RN: "America/Fortaleza",
  RS: "America/Sao_Paulo", RO: "America/Porto_Velho", RR: "America/Boa_Vista", SC: "America/Sao_Paulo", SP: "America/Sao_Paulo",
  SE: "America/Maceio", TO: "America/Araguaina",
};

export type City = { name: string; uf: string; lat: number; lon: number; timeZone: string };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const CITIES: Array<City & { key: string }> = (rows as Array<[string, string, number, number, string?]>).map(([name, uf, lat, lon, tz]) => ({
  name, uf, lat, lon, timeZone: tz ?? UF_ZONE[uf] ?? "America/Sao_Paulo", key: fold(name),
}));

const strip = ({ key: _key, ...city }: City & { key: string }): City => city;

export function searchCities(query: string, limit = 8): City[] {
  const q = fold(query);
  if (q.length < 2) return [];
  const starts = CITIES.filter((c) => c.key.startsWith(q));
  const contains = starts.length >= limit ? [] : CITIES.filter((c) => !c.key.startsWith(q) && c.key.includes(q));
  return [...starts, ...contains].slice(0, limit).map(strip);
}

export function findCity(name: string, uf: string): City | null {
  const key = fold(name), u = uf.toUpperCase();
  const hit = CITIES.find((c) => c.key === key && c.uf === u);
  return hit ? strip(hit) : null;
}
