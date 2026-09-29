/**
 * Безопасная обёртка над localStorage.
 *
 * Решает 3 проблемы:
 * 1. SSR — на сервере window/localStorage недоступны (TypeError).
 * 2. QuotaExceededError — переполнение хранилища (5MB лимит).
 * 3. SecurityError — private mode в Safari блокирует доступ.
 *
 * Все методы возвращают fallback при любой ошибке — никогда не throw.
 */

export const storage = {
  /**
   * Получить значение из localStorage.
   * @param key — ключ
   * @returns строка или null
   */
  get(key: string): string | null {
    if (typeof window === "undefined") return null
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },

  /**
   * Установить значение в localStorage.
   * @param key — ключ
   * @param value — строка
   * @returns true если успешно, false при ошибке
   */
  set(key: string, value: string): boolean {
    if (typeof window === "undefined") return false
    try {
      window.localStorage.setItem(key, value)
      return true
    } catch {
      // QuotaExceededError или SecurityError — тихо игнорируем
      return false
    }
  },

  /**
   * Удалить ключ из localStorage.
   */
  remove(key: string): void {
    if (typeof window === "undefined") return
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignore
    }
  },

  /**
   * Получить JSON-значение из localStorage.
   * @param key — ключ
   * @param fallback — значение по умолчанию при ошибке
   * @returns распарсенный объект или fallback
   */
  getJSON<T>(key: string, fallback: T): T {
    const raw = this.get(key)
    if (raw === null) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  },

  /**
   * Сохранить JSON-объект в localStorage.
   * @param key — ключ
   * @param value — объект (будет JSON.stringify)
   * @returns true если успешно
   */
  setJSON(key: string, value: unknown): boolean {
    try {
      return this.set(key, JSON.stringify(value))
    } catch {
      return false
    }
  },

  /**
   * Получить булево значение из localStorage.
   * @param key — ключ
   * @param fallback — значение по умолчанию
   */
  getBool(key: string, fallback = false): boolean {
    const raw = this.get(key)
    if (raw === null) return fallback
    return raw === "true" || raw === "1"
  },

  /**
   * Сохранить булево значение.
   */
  setBool(key: string, value: boolean): boolean {
    return this.set(key, value ? "true" : "false")
  },
}
