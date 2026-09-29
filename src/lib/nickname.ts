"use client"

// Глобальный никнейм игрока: обязателен при первом заходе на сайт,
// сохраняется в localStorage и используется в мультиплеере (кто за каким
// устройством) и в аналитике визитов (кто заходил).
//
// Правила ника живут в @/lib/nickname-rules — отсюда только реэкспорт, чтобы
// клиент и сервер не разъезжались в проверках. Занятость проверяет сервер
// (/api/nicknames), локально знать её невозможно.

import { readItem, writeItem } from "@/lib/storage"
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH, validateNickname } from "@/lib/nickname-rules"

const NICKNAME_STORAGE_KEY = "nastolka-nickname-v1"

export { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH, validateNickname }
export type { NicknameRejectReason, NicknameValidation } from "@/lib/nickname-rules"

/** Прочитать сохранённый никнейм ("" если нет) */
export function getNickname(): string {
  if (typeof window === "undefined") return ""
  return (readItem(NICKNAME_STORAGE_KEY) || "").trim()
}

/** Сохранить никнейм */
export function saveNickname(nickname: string): void {
  if (typeof window === "undefined") return
  writeItem(NICKNAME_STORAGE_KEY, nickname.trim().slice(0, NICKNAME_MAX_LENGTH))
}

/** Есть ли сохранённый никнейм (для обязательной модалки первого входа) */
export function hasNickname(): boolean {
  return getNickname().length > 0
}

const DEVICE_KEY_STORAGE = "nastolka-device-key-v1"

/**
 * Стабильный ключ этого браузера: по нему сервер понимает, что ник занят тем же
 * игроком, и не мешает ему вернуть прежний ник. Хранится в localStorage, поэтому
 * переживает перезагрузку; в режиме инкогнито живёт до закрытия вкладки — это
 * не ломает вход, просто ник перестаёт считаться «своим».
 */
export function getDeviceKey(): string {
  if (typeof window === "undefined") return ""
  const saved = readItem(DEVICE_KEY_STORAGE)
  if (saved) return saved
  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  writeItem(DEVICE_KEY_STORAGE, generated)
  return generated
}

/** Сгенерировать случайный никнейм (кнопка «Мне повезёт») */
export function randomNickname(): string {
  const adjectives = ["Весёлый", "Быстрый", "Хитрый", "Смелый", "Дикий", "Лютый", "Яркий", "Тёплый", "Злой", "Мудрый"]
  const nouns = ["Лис", "Медведь", "Волк", "Тигр", "Ёж", "Кит", "Сокол", "Барс", "Зубр", "Крот"]
  const a = adjectives[Math.floor(Math.random() * adjectives.length)]
  const n = nouns[Math.floor(Math.random() * nouns.length)]
  return `${a} ${n}`
}

// ─── Проверка занятости через сервер ─────────────────────────────────────────

export type NicknameProblem = "empty" | "tooShort" | "tooLong" | "invalidChars"

export type NicknameCheck =
  /** Запрос в пути — кнопку «Играть» на это время держим нажатой */
  | { state: "checking" }
  /** Ник свободен (или его заняло это же устройство) */
  | { state: "available"; nickname: string }
  /** Ник занят другим игроком; suggestion — свободный вариант, если подобран */
  | { state: "taken"; nickname: string; suggestion: string | null }
  /** Ник не проходит правила — причину показываем сразу, запрос не уходил */
  | { state: "invalid"; problem: NicknameProblem }
  /** Сервер недоступен: занятость неизвестна, но входить всё равно можно */
  | { state: "offline" }

/**
 * Свободен ли никнейм. Ошибку сети намеренно НЕ считаем отказом: без связи с
 * сервером игрок всё равно должен попасть в игру, иначе сайт ляжет целиком.
 */
export async function checkNicknameAvailability(nickname: string, deviceId: string): Promise<NicknameCheck> {
  const validation = validateNickname(nickname)
  if (!validation.valid) return { state: "invalid", problem: validation.reason ?? "invalidChars" }

  try {
    const params = new URLSearchParams({ nickname: validation.normalized, deviceId })
    const response = await fetch(`/api/nicknames?${params.toString()}`, { cache: "no-store" })
    const data = (await response.json().catch(() => null)) as {
      available?: boolean
      nickname?: string
      reason?: string
      suggestion?: string | null
    } | null

    if (data?.available === true) return { state: "available", nickname: data.nickname || validation.normalized }
    if (data?.reason === "taken") {
      return {
        state: "taken",
        nickname: data.nickname || validation.normalized,
        suggestion: data.suggestion ?? null,
      }
    }
    if (response.status === 400) return { state: "invalid", problem: "invalidChars" }
    return { state: "offline" }
  } catch {
    return { state: "offline" }
  }
}

export type NicknameClaim =
  | { ok: true; nickname: string }
  | { ok: false; reason: NicknameProblem | "taken" | "unavailable" }

/**
 * Закрепить ник за игроком (POST /api/nicknames). Если ник увели — возвращаем
 * reason:"taken", и модалка остаётся открытой с предложением свободного варианта.
 */
export async function claimNickname(nickname: string, deviceId: string): Promise<NicknameClaim> {
  const validation = validateNickname(nickname)
  if (!validation.valid) return { ok: false, reason: validation.reason ?? "invalidChars" }

  try {
    const response = await fetch("/api/nicknames", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: validation.normalized, deviceId }),
    })
    const data = (await response.json().catch(() => null)) as
      | { available?: boolean; nickname?: string; reason?: string; detail?: string }
      | null

    if (response.ok && data?.available === true) {
      return { ok: true, nickname: data.nickname || validation.normalized }
    }
    if (response.status === 409 || data?.reason === "taken") return { ok: false, reason: "taken" }
    if (response.status === 400) {
      const detail = data?.detail as NicknameProblem | "registryFull" | undefined
      return { ok: false, reason: detail && detail !== "registryFull" ? detail : "invalidChars" }
    }
    // 429/5xx — сервер не смог записать ник
    return { ok: false, reason: "unavailable" }
  } catch {
    return { ok: false, reason: "unavailable" }
  }
}

/**
 * «Мне повезёт»: сгенерировать комбинацию и, если она занята, сразу предложить
 * свободную по правилу «Маша» → «Маша 2».
 */
export async function suggestUniqueNickname(deviceId: string): Promise<string> {
  const base = randomNickname().slice(0, NICKNAME_MAX_LENGTH)
  const result = await checkNicknameAvailability(base, deviceId)
  if (result.state === "taken") return result.suggestion ?? base
  return base
}
