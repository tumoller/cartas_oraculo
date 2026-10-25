import assert from "node:assert/strict";
import { test } from "node:test";
import { getReadingFontSize, setReadingFontSize } from "../src/lib/reading-font.ts";

test("tamanho de leitura restaura só escolhas válidas e funciona sem armazenamento", () => {
  const previousStorage = globalThis.localStorage;
  const previousDocument = globalThis.document;
  let saved = "22";
  const applied = {};
  globalThis.localStorage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
  globalThis.document = { documentElement: { style: { setProperty: (key, value) => { applied[key] = value; } } } };
  try {
    assert.equal(getReadingFontSize(), 22);
    saved = "500";
    assert.equal(getReadingFontSize(), 18);
    setReadingFontSize(20);
    assert.equal(saved, "20");
    assert.equal(applied["--reading-font-size"], "20px");
    assert.equal(applied["--ui-text-scale"], String(20 / 18));
    globalThis.localStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    assert.equal(getReadingFontSize(), 18);
    assert.doesNotThrow(() => setReadingFontSize(18));
  } finally {
    globalThis.localStorage = previousStorage;
    globalThis.document = previousDocument;
  }
});
