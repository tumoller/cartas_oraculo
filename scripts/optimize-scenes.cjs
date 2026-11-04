// Gera versões WebP leves das cenas (public/scenes/*.png -> *.webp) para o celular.
// Uso: node scripts/optimize-scenes.cjs
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const dir = path.join(__dirname, "..", "public", "scenes");

(async () => {
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".png"))) {
    const input = path.join(dir, file);
    const output = input.replace(/\.png$/, ".webp");
    await sharp(input).webp({ quality: 78, effort: 5 }).toFile(output);
    const before = fs.statSync(input).size;
    const after = fs.statSync(output).size;
    console.log(`${file}: ${Math.round(before / 1024)}KB -> ${Math.round(after / 1024)}KB`);
  }
})();
