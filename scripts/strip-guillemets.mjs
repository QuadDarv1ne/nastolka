// Убирает кавычки-ёлочки («») во всех файлах проекта.
// Запуск: node scripts/strip-guillemets.mjs
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "src/components/drawing-canvas.tsx",
  "src/components/achievements-dialog.tsx",
  "src/components/dice.tsx",
  "src/components/song-recorder.tsx",
  "src/app/layout.tsx",
  "src/app/api/health/route.ts",
  "src/app/page.tsx",
  "src/lib/sounds.ts",
  "src/lib/achievements.ts",
  "src/lib/i18n.ts",
  "src/lib/game-data.ts",
  "src/lib/multiplayer.ts",
  "public/manifest.json",
  "mini-services/nastolka-multiplayer/index.ts",
  "dev.sh",
  "dev.ps1",
  "RUN.md",
  "README.md",
];

let total = 0;
for (const f of files) {
  const buf = readFileSync(f);
  const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  let text = buf.toString("utf8");
  if (hasBom) text = text.slice(1); // отрезаем BOM для подсчёта/замены, вернём при записи
  const count = (text.match(/[«»]/g) || []).length;
  if (count === 0) continue;
  const cleaned = text.replace(/[«»]/g, "");
  writeFileSync(f, Buffer.concat([hasBom ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.alloc(0), Buffer.from(cleaned, "utf8")]));
  total += count;
  console.log(`cleaned: ${f} (${count} removed)`);
}
console.log(`total: ${total} guillemets removed`);
