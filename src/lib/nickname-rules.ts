// Правила никнейма: нормализация и валидация.
//
// Модуль без "use client" и без обращений к localStorage/Node-API — поэтому его
// можно импортировать отовсюду: из компонентов, из socket.io-сервера мини-сервиса
// nastolka-multiplayer и из роутера /api/nicknames. Все три точки входа обязаны
// проверять ник одинаково, иначе игрок обойдёт валидацию на слабом звене.

/** Минимальная длина никнейма (в символах после нормализации) */
export const NICKNAME_MIN_LENGTH = 2

/** Максимальная длина никнейма (в символах после нормализации) */
export const NICKNAME_MAX_LENGTH = 24

/**
 * Разрешены буквы любого алфавита (включая кириллицу), цифры, пробел, дефис
 * и нижнее подчёркивание. Эмодзи, скобки, управляющие символы и «/» отсекаются:
 * ник попадает в разметку комнаты и в имя файла реестра.
 */
const NICKNAME_ALLOWED_CHARS = /^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u

/** Почему ник не подошёл (для сообщения в UI и для кода ошибки API) */
export type NicknameRejectReason = "empty" | "tooShort" | "tooLong" | "invalidChars"

/** Нормализовать ник: trim, схлопнуть повторяющиеся пробелы */
export function normalizeNickname(raw: string): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim()
}

/**
 * Ключ для сравнения «занят ли такой ник»: без регистра, диакритики и
 * различий регистронезависимых алфавитов. «Маша», «маша» и «MAŠA» — один ник.
 */
export function nicknameKey(raw: string): string {
  return normalizeNickname(raw).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
}

export interface NicknameValidation {
  valid: boolean
  /** Ник после нормализации (его и показываем/сохраняем) */
  normalized: string
  /** Причина отказа, если валидация не прошла */
  reason?: NicknameRejectReason
}

/** Проверить ник по правилам выше. Нормализует перед проверкой длины. */
export function validateNickname(raw: string): NicknameValidation {
  const normalized = normalizeNickname(raw)
  if (!normalized) return { valid: false, normalized, reason: "empty" }
  if ([...normalized].length < NICKNAME_MIN_LENGTH) return { valid: false, normalized, reason: "tooShort" }
  if ([...normalized].length > NICKNAME_MAX_LENGTH) return { valid: false, normalized, reason: "tooLong" }
  if (!NICKNAME_ALLOWED_CHARS.test(normalized)) return { valid: false, normalized, reason: "invalidChars" }
  return { valid: true, normalized }
}

/** Занят ли вводимый ник среди уже зарегистрированных (сравнение по nicknameKey) */
export function isNicknameTaken(candidate: string, taken: string[]): boolean {
  const key = nicknameKey(candidate)
  if (!key) return false
  return taken.some((nick) => nicknameKey(nick) === key)
}

/**
 * Подсказать свободный вариант занятого ника: «Маша» → «Маша 2».
 * Перебираем суффиксы, пока не упрёмся в лимит длины.
 */
export function suggestNickname(takenNick: string, isTaken: (candidate: string) => boolean): string | null {
  const base = normalizeNickname(takenNick)
  if (!base) return null
  for (let suffix = 2; suffix <= 99; suffix++) {
    const tail = ` ${suffix}`
    const head = base.slice(0, Math.max(0, NICKNAME_MAX_LENGTH - tail.length)).trim()
    if (!head) return null
    const candidate = `${head}${tail}`
    if (!isTaken(candidate)) return candidate
  }
  return null
}
