import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { sceneAssets } from "../src/lib/scene-assets.ts";

test("as cenas usam arquivos existentes e usam os três retratos aprovados", () => {
  for (const persona of ["Linha de Umbanda", "Cigana Tradicional", "Oráculo da Galáxia"]) {
    const scene = sceneAssets(persona);
    for (const file of [scene.portrait, scene.close]) assert.ok(existsSync(new URL(`../public${file}`, import.meta.url)), file);
  }
  assert.equal(sceneAssets("Cigana Tradicional").portrait, "/avatars/cigana-meio-corpo-realista.png");
  assert.match(sceneAssets("Linha de Umbanda").portrait, /umbanda-meio-corpo-realista/);
  assert.match(sceneAssets("Oráculo da Galáxia").portrait, /cosmico-meio-corpo-realista/);
});
