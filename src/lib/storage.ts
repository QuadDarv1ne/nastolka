// Единая безопасная обёртка над localStorage.
//
// localStorage может бросать исключения:
//  • Safari Private Browsing и браузеры с блокировкой данных — SecurityError
//    уже на обращении к свойству window.localStorage;
//  • переполнение квоты — QuotaExceededError на setItem;
//  • битые/чужие данные — JSON.parse выбрасывается на getItem.
//
// Все модули приложения должны читать/писать хранилище только через эти
// функции — тогда приватный режим или переполнение квоты не сломают игру,
// а просто превратят сохранение в no-op.

function store(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    const s = window.localStorage
    return s ?? null
  } catch {
    // Доступ к localStorage запрещён настройками браузера
    return null
  }
}

/** Прочитать строку; null если хранилище недоступно или ключа нет */
export function readItem(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null
  } catch {
    return null
  }
}

/** Записать строку; возвращает false если запись невозможна */
export function writeItem(key: string, value: string): boolean {
  try {
    store()?.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** Удалить ключ */
export function removeItem(key: string): void {
  try {
    store()?.removeItem(key)
  } catch {
    // ignore
  }
}

/** Хранилище сессии (живёт до закрытия вкладки) — безопасная обёртка над sessionStorage */
function sessionStore(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    return window.sessionStorage ?? null
  } catch {
    return null
  }
}

/** Прочитать строку из sessionStorage; null при недоступности/отсутствии ключа */
export function readSessionItem(key: string): string | null {
  try {
    return sessionStore()?.getItem(key) ?? null
  } catch {
    return null
  }
}

/** Записать строку в sessionStorage; возвращает false если запись невозможна */
export function writeSessionItem(key: string, value: string): boolean {
  try {
    sessionStore()?.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** Удалить ключ из sessionStorage */
export function removeSessionItem(key: string): void {
  try {
    sessionStore()?.removeItem(key)
  } catch {
    // ignore
  }
}

/** Прочитать и разобрать JSON из sessionStorage; null при ошибке/отсутствии данных */
export function readSessionJson<T>(key: string): T | null {
  const raw = readSessionItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Сериализовать и записать JSON в sessionStorage */
export function writeSessionJson(key: string, value: unknown): boolean {
  try {
    return writeSessionItem(key, JSON.stringify(value))
  } catch {
    return false
  }
}

/** Прочитать и разобрать JSON; null при ошибке/отсутствии данных */
export function readJson<T>(key: string): T | null {
  const raw = readItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Сериализовать и записать JSON; возвращает false если запись невозможна */
export function writeJson(key: string, value: unknown): boolean {
  try {
    return writeItem(key, JSON.stringify(value))
  } catch {
    return false
  }
}
