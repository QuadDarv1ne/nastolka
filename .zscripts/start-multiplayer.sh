#!/usr/bin/env bash
# Автозапуск mini-service мультиплеера (порт 3003).
# Используется dev.sh и может запускаться отдельно.
set -euo pipefail
cd "$(dirname "$0")/../mini-services/nastolka-multiplayer"

# Зависимости — ставим только если их ещё нет
if [ ! -d node_modules ]; then
  echo "[multiplayer] installing deps..."
  if command -v bun >/dev/null 2>&1; then
    bun install
  else
    npm install
  fi
fi

if command -v bun >/dev/null 2>&1; then
  exec bun --hot index.ts
else
  exec node --experimental-strip-types index.ts 2>/dev/null || npx tsx index.ts
fi
