import { NextResponse, type NextRequest } from "next/server";
import { nicknameKey, suggestNickname, validateNickname } from "@/lib/nickname-rules";
import { checkAvailability, claimNickname, readRegistry } from "@/lib/nickname-registry";

export const runtime = "nodejs";

/**
 * Проверка ника при вводе.
 *   GET /api/nicknames?nickname=Маша&deviceId=dev-...
 *   → { available: true,  nickname: "Маша" }
 *   → { available: false, reason: "taken", nickname: "Маша", suggestion: "Маша 2" }
 *   → { available: false, reason: "invalid", detail: "tooShort" }
 *
 * deviceId участвует в проверке намеренно: ник, который заняло ЭТО ЖЕ устройство,
 * не считается занятым. Иначе повторный вход и смена ника на прежний ломались бы.
 */
export async function GET(request: NextRequest) {
  const limited = rateLimitResponse(request);
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const candidate = params.get("nickname") ?? params.get("nick") ?? "";
  const deviceId = normalizeDeviceId(params.get("deviceId"));

  const result = checkAvailability(candidate, deviceId);

  if (result.available) {
    return NextResponse.json({ available: true, nickname: result.nick });
  }

  if (result.reason === "taken") {
    return NextResponse.json({
      available: false,
      reason: "taken" as const,
      nickname: result.nick,
      suggestion: suggestionFor(result.nick, deviceId),
    });
  }

  return NextResponse.json(
    { available: false, reason: "invalid" as const, detail: result.detail },
    { status: 400 },
  );
}

/**
 * Занять ник.
 *   POST /api/nicknames { nickname, deviceId }
 *   201 — ник занят этим устройством;
 *   409 — ник уже занят другим игроком (в ответе есть подсказка);
 *   400 — ник не проходит правила или реестр заполнен;
 *   429 — слишком много попыток;
 *   500 — реестр недоступен (сервер не смог записать файл).
 */
export async function POST(request: NextRequest) {
  const limited = rateLimitResponse(request);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as { nickname?: unknown; deviceId?: unknown } | null;
  const nickname = typeof body?.nickname === "string" ? body.nickname : "";
  const deviceId = normalizeDeviceId(typeof body?.deviceId === "string" ? body.deviceId : null);

  const validation = validateNickname(nickname);
  if (!validation.valid) {
    return NextResponse.json(
      { available: false, reason: "invalid" as const, detail: validation.reason },
      { status: 400 },
    );
  }

  const result = claimNickname(validation.normalized, deviceId);
  if (result.ok) return NextResponse.json({ available: true, nickname: result.nick }, { status: 201 });

  if (result.reason === "taken") {
    return NextResponse.json(
      {
        available: false,
        reason: "taken" as const,
        nickname: result.nick ?? validation.normalized,
        suggestion: suggestionFor(result.nick ?? validation.normalized, deviceId),
      },
      { status: 409 },
    );
  }

  // detail: "registryFull" | "storageError" — обе проблемы на стороне сервера
  const status = result.detail === "storageError" ? 500 : 400;
  return NextResponse.json(
    { available: false, reason: "invalid" as const, detail: result.detail },
    { status },
  );
}

// ─── Подсказка свободного ника ───────────────────────────────────────────────

/**
 * Подобрать свободный вариант занятого ника («Маша» → «Маша 2»).
 * Занятость считаем по тому же правилу, что и проверку: чужой ник занят,
 * свой (тот же deviceId) — свободен.
 */
function suggestionFor(takenNickname: string, deviceId?: string): string | null {
  const registry = readRegistry();
  return suggestNickname(takenNickname, (candidate) => {
    const record = registry[nicknameKey(candidate)];
    return !!record && record.owner !== deviceId;
  });
}

// ─── Ограничение частоты запросов ────────────────────────────────────────────
// Занятые ники не должны перебираться сотнями запросов в секунду.
// Счётчик в памяти процесса: на одном сервере этого достаточно, при
// горизонтальном масштабировании его нужно выносить в общее хранилище.

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 40;

const hits = new Map<string, number[]>();

const clientKey = (request: NextRequest) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "local";
};

/** deviceId приходит из браузера — режем всё лишнее, он попадает в имя файла-заметки */
const normalizeDeviceId = (raw: string | null | undefined): string | undefined => {
  const value = raw?.trim();
  if (!value) return undefined;
  return value.slice(0, 64);
};

function rateLimitResponse(request: NextRequest): NextResponse | null {
  if (process.env.NICKNAME_RATE_LIMIT_DISABLED === "1") return null;

  const key = clientKey(request);
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);

  // Периодически выбрасываем устаревшие ключи, иначе карта растёт бесконечно.
  if (hits.size > 5_000) {
    for (const [entry, times] of hits) {
      if (!times.some((at) => now - at < RATE_WINDOW_MS)) hits.delete(entry);
    }
  }

  if (recent.length > RATE_MAX_REQUESTS) {
    return NextResponse.json(
      { available: false, reason: "invalid" as const, detail: "tooManyRequests" },
      { status: 429, headers: { "retry-after": String(Math.ceil(RATE_WINDOW_MS / 1000)) } },
    );
  }

  return null;
}
