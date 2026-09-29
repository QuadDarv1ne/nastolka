# ─────────────────────────────────────────────────────────────
# Dockerfile для «Настолки» — production-ready Next.js standalone
# Подходит для деплоя на Amvera (https://cloud.amvera.ru/)
# ─────────────────────────────────────────────────────────────

# ---- Stage 1: deps ----
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Копируем только манифесты зависимостей для кэширования слоя
COPY package.json package-lock.json* ./
# Если lockfile от bun — конвертируем в npm-совместимый
RUN if [ ! -f package-lock.json ]; then \
      echo "no package-lock.json — generating from package.json"; \
      npm install --legacy-peer-deps --no-audit --no-fund; \
    else \
      npm ci --legacy-peer-deps --no-audit --no-fund; \
    fi

# ---- Stage 2: builder ----
FROM node:18-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js собирает standalone-сервер в .next/standalone
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Stage 3: runner ----
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Создаём непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

# Копируем standalone-сервер, статику и публичные ассеты
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Права на запись для кэша Next.js
RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# standalone-сервер Next.js
CMD ["node", "server.js"]
