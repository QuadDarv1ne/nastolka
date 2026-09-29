#!/usr/bin/env node
/**
 * copy-standalone.mjs
 *
 * Helper для сборки Next.js standalone-сервера.
 * После `next build` с `output: "standalone"` в .next/standalone
 * оказывается минимальный server.js, но НЕ копируются:
 *   - .next/static  (статика: JS-чанки, CSS)
 *   - public        (favicon, manifest, robots.txt, иконки)
 *
 * Этот скрипт дозакопирует эти ресурсы, чтобы .next/standalone/
 * был полностью готов к запуску в Docker/проде.
 *
 * Использование:
 *   node scripts/copy-standalone.mjs
 *   (или через package.json: "build": "next build && node scripts/copy-standalone.mjs")
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, "..")

const standaloneDir = join(rootDir, ".next", "standalone")
const staticSource = join(rootDir, ".next", "static")
const staticTarget = join(standaloneDir, ".next", "static")
const publicSource = join(rootDir, "public")
const publicTarget = join(standaloneDir, "public")

function log(msg) {
  console.log(`[copy-standalone] ${msg}`)
}

function fail(msg) {
  console.error(`[copy-standalone] ERROR: ${msg}`)
  process.exit(1)
}

function sizeHuman(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function dirSize(dir) {
  let total = 0
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const path = join(dir, e.name)
    if (e.isDirectory()) total += dirSize(path)
    else total += statSync(path).size
  }
  return total
}

// --- Проверки ---
if (!existsSync(standaloneDir)) {
  fail(`standalone директория не найдена: ${standaloneDir}. Сначала запустите \`next build\`.`)
}

// --- 1. Копируем .next/static ---
log("Копирую .next/static → .next/standalone/.next/static")
if (!existsSync(staticSource)) {
  fail(`static не найден: ${staticSource}. Сначала запустите \`next build\`.`)
}
// Удаляем старую копию, если есть
if (existsSync(staticTarget)) rmSync(staticTarget, { recursive: true, force: true })
mkdirSync(dirname(staticTarget), { recursive: true })
cpSync(staticSource, staticTarget, { recursive: true })
const staticSize = existsSync(staticTarget) ? dirSize(staticTarget) : 0
log(`  ✓ Скопировано: ${sizeHuman(staticSize)}`)

// --- 2. Копируем public/ ---
log("Копирую public/ → .next/standalone/public")
if (!existsSync(publicSource)) {
  log("  ! public/ не найден — пропускаю (возможно, нет публичных ассетов)")
} else {
  if (existsSync(publicTarget)) rmSync(publicTarget, { recursive: true, force: true })
  cpSync(publicSource, publicTarget, { recursive: true })
  const publicSize = existsSync(publicTarget) ? dirSize(publicTarget) : 0
  log(`  ✓ Скопировано: ${sizeHuman(publicSize)}`)
}

// --- Итог ---
log("✓ Standalone-сборка готова:")
log(`    ${standaloneDir}`)
log(`    Запуск: NODE_ENV=production node ${join(standaloneDir, "server.js")}`)
