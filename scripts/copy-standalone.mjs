// Кроссплатформенная замена `cp -r` из build-скрипта (работает и на Windows).
// Копирует статику и публичные ассеты в standalone-сервер Next.js.
import { cpSync, mkdirSync } from "node:fs";

mkdirSync(".next/standalone/.next", { recursive: true });

cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
cpSync("public", ".next/standalone/public", { recursive: true });

console.log("[build] standalone assets copied: .next/static, public");
