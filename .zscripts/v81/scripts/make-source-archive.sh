#!/bin/bash
# Создаёт source-архив nastolka-vN.tar.gz и .zip
# Включает только исходники и конфиги — без node_modules, .next, .git

set -e

PROJECT_DIR="/home/z/my-project"
VERSION="${1:-v70}"
OUT_DIR="${PROJECT_DIR}/download"

if [ ! -d "$OUT_DIR" ]; then
  mkdir -p "$OUT_DIR"
fi

echo "📦 Создаём source-архив nastolka-${VERSION}..."

# Список файлов/папок, которые попадут в архив
INCLUDE=(
  Caddyfile
  Dockerfile
  README.md
  RUN.md
  amvera.yml
  amvera.nodejs.yml
  bun.lock
  components.json
  eslint.config.mjs
  next.config.ts
  package.json
  postcss.config.mjs
  tailwind.config.ts
  tsconfig.json
  .env
  .gitignore
  .dockerignore
  db/
  mini-services/
  prisma/
  public/
  scripts/
  src/
  worklog.md
)

# Временная staging-директория
STAGE="/tmp/nastolka-${VERSION}-stage"
rm -rf "$STAGE"
mkdir -p "$STAGE"

cd "$PROJECT_DIR"
for item in "${INCLUDE[@]}"; do
  if [ -e "$item" ]; then
    # Создаём родительскую директорию в staging
    mkdir -p "$STAGE/$(dirname "$item")"
    cp -r "$item" "$STAGE/$item"
  fi
done

# Создаём tar.gz
TARGZ="${OUT_DIR}/nastolka-${VERSION}.tar.gz"
echo "  → tar.gz: $TARGZ"
cd "$STAGE"
tar -czf "$TARGZ" .

# Создаём zip
ZIP="${OUT_DIR}/nastolka-${VERSION}.zip"
echo "  → zip:    $ZIP"
which zip > /dev/null 2>&1 && zip -r -q "$ZIP" . || python3 -c "
import zipfile, os
with zipfile.ZipFile('$ZIP', 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk('.'):
        for f in files:
            path = os.path.join(root, f)
            zf.write(path, path)
"

# Очистка staging
cd /
rm -rf "$STAGE"

# Отчёт
echo ""
echo "✅ Архив nastolka-${VERSION} готов:"
ls -lh "$TARGZ" "$ZIP"
echo ""
echo "Содержимое (количество файлов):"
tar tzf "$TARGZ" | wc -l
