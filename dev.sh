#!/usr/bin/env bash
# dev.sh — автозапуск dev-сервера «Настолки» вместе с mini-service мультиплеера.
#
#   bash dev.sh          # Next.js (3000) + WebSocket-мультиплеер (3003)
#   bash dev.sh --no-mp  # только Next.js
#
# Работает в Linux, macOS и Git Bash на Windows.
# Альтернатива на Windows (PowerShell): .\dev.ps1

set -euo pipefail
cd "$(dirname "$0")"

MP_PID=""

cleanup() {
  if [ -n "$MP_PID" ] && kill -0 "$MP_PID" 2>/dev/null; then
    echo ""
    echo "[dev] stopping multiplayer server (pid $MP_PID)..."
    kill "$MP_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if [ "${1:-}" != "--no-mp" ]; then
  echo "[dev] starting multiplayer mini-service on port ${MP_PORT:-3003}..."
  bash .zscripts/start-multiplayer.sh &
  MP_PID=$!
  sleep 2
  if kill -0 "$MP_PID" 2>/dev/null; then
    echo "[dev] multiplayer server started (pid $MP_PID)"
  else
    echo "[dev] WARNING: multiplayer server failed to start — продолжаем без него"
    MP_PID=""
  fi
else
  echo "[dev] multiplayer disabled (--no-mp)"
fi

# Показываем адреса для игры с других устройств в той же Wi-Fi сети
echo ""
echo "─────────────────────────────────────────────────"
echo "  Игра на этом устройстве:  http://localhost:3000"
echo "  Игра с телефона/планшета по Wi-Fi:"
IP_ADDRS=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null || ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '^127\.' || true)
for ip in $IP_ADDRS; do
  echo "    http://$ip:3000"
done
echo "  (мультиплеер: порт ${MP_PORT:-3003}, не блокируйте его фаерволом)"
echo "─────────────────────────────────────────────────"
echo ""

echo "[dev] starting Next.js on port 3000..."
if command -v bun >/dev/null 2>&1; then
  bun run dev
else
  npm run dev
fi
