const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

// Carrega src/lib/cities.ts trocando o alias "@/data/municipios.json" pelo arquivo real.
const filename = path.resolve(__dirname, "../src/lib/cities.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const mod = { exports: {} };
const req = (id) => require(id === "@/data/municipios.json" ? path.resolve(__dirname, "../src/data/municipios.json") : id);
new Function("exports", "require", "module", compiled)(mod.exports, req, mod);
const { searchCities, findCity } = mod.exports;

test("busca ignora acentos e prioriza o começo do nome", () => {
  const r = searchCities("sao paulo");
  assert.equal(r[0].name, "São Paulo");
  assert.equal(r[0].uf, "SP");
  assert.deepEqual(searchCities("a"), []);
});

test("fuso por UF preserva o histórico regional", () => {
  assert.equal(findCity("Recife", "PE").timeZone, "America/Recife");
  assert.equal(findCity("Campo Grande", "MS").timeZone, "America/Campo_Grande");
  assert.equal(findCity("Salvador", "BA").timeZone, "America/Bahia");
  assert.equal(findCity("Fernando de Noronha", "PE").timeZone, "America/Noronha");
  assert.equal(findCity("Cidade Que Não Existe", "SP"), null);
});
