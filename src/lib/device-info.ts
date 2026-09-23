"use client"

// Полное определение устройства пользователя: модель, версии ОС/браузера,
// экран, DPR, часовой пояс, touch, CPU-ядра, память. Используется:
//  • в мультиплеере — чтобы понять, кто за каким устройством;
//  • в аналитике админки — POST /api/visitors при заходе на сайт.

/** Полный профиль устройства */
export interface DeviceInfo {
  // Тип и модель
  deviceType: "phone" | "tablet" | "desktop" | "unknown"
  model: string              // iPhone 15 / Pixel 8 / ПК
  // ОС + версия
  os: string                 // iOS / Android / Windows …
  osVersion: string          // 17.4 / 14 / 11
  // Браузер + версия
  browser: string            // Safari / Chrome …
  browserVersion: string
  // Экран
  screenW: number
  screenH: number
  dpr: number                // devicePixelRatio
  // Окружение
  timezone: string           // Europe/Moscow
  language: string           // ru
  touch: boolean             // есть ли сенсорный ввод
  cores: number | null       // navigator.hardwareConcurrency
  memoryGb: number | null    // navigator.deviceMemory (приблизительно)
  userAgent: string
}

const UNKNOWN_DEVICE: DeviceInfo = {
  deviceType: "unknown",
  model: "unknown",
  os: "unknown",
  osVersion: "",
  browser: "unknown",
  browserVersion: "",
  screenW: 0,
  screenH: 0,
  dpr: 1,
  timezone: "",
  language: "",
  touch: false,
  cores: null,
  memoryGb: null,
  userAgent: "",
}

/** Разобрать User-Agent: тип, модель, ОС+версия, браузер+версия */
function parseUserAgent(ua: string): Pick<DeviceInfo, "deviceType" | "model" | "os" | "osVersion" | "browser" | "browserVersion"> {
  // ── Тип устройства ──
  const isTablet = /ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))
  const isPhone = /iphone|ipod|android.*mobile|windows phone|mobile/i.test(ua)
  const deviceType: DeviceInfo["deviceType"] = isTablet
    ? "tablet"
    : isPhone
      ? "phone"
      : /windows|macintosh|linux|cros/i.test(ua)
        ? "desktop"
        : "unknown"

  // ── ОС + версия ──
  let os = "unknown"
  let osVersion = ""
  if (/windows phone/i.test(ua)) {
    os = "Windows Phone"
    const m = ua.match(/windows phone (?:os )?([\d.]+)/i)
    if (m) osVersion = m[1]
  } else if (/windows nt/i.test(ua)) {
    os = "Windows"
    const nt = ua.match(/windows nt ([\d.]+)/i)?.[1]
    const ntToWin: Record<string, string> = {
      "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7", "6.0": "Vista", "5.1": "XP",
    }
    osVersion = nt ? (ntToWin[nt] || nt) : ""
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = "iOS"
    const m = ua.match(/os (\d+[_.]\d+(?:[_.]\d+)?)/i)
    if (m) osVersion = m[1].replace(/_/g, ".")
  } else if (/android/i.test(ua)) {
    os = "Android"
    const m = ua.match(/android ([\d.]+)/i)
    if (m) osVersion = m[1]
  } else if (/mac os x|macintosh/i.test(ua)) {
    os = "macOS"
    // В новых Safari версию macOS прячут; выцепляем по build-номеру
    const m = ua.match(/mac os x (\d+[_.]\d+)/i)
    if (m) osVersion = m[1].replace(/_/g, ".")
  } else if (/cros/i.test(ua)) {
    os = "ChromeOS"
  } else if (/linux/i.test(ua)) {
    os = "Linux"
  }

  // ── Модель ──
  let model = "unknown"
  if (/iphone/i.test(ua)) model = "iPhone"
  else if (/ipad/i.test(ua)) model = "iPad"
  else if (/ipod/i.test(ua)) model = "iPod"
  else if (deviceType === "desktop") model = os === "unknown" ? "ПК" : `ПК (${os})`
  else if (os === "Android") {
    // Android: "Android 14; K; Pixel 8)" — модель обычно последним сегментом
    const closeIdx = ua.indexOf(")")
    const androidPart = ua.slice(ua.indexOf("Android"), closeIdx > 0 ? closeIdx : ua.length)
    const segments = androidPart.split(";").map((s) => s.trim()).slice(1)
    const candidates = segments.filter(
      (p) => p && !/^[a-z]{2}-[a-z]{2}$/i.test(p) && !/^(k|wv|build)$/i.test(p),
    )
    model = candidates[candidates.length - 1] || "Android"
  }

  // ── Браузер + версия ──
  let browser = "unknown"
  let browserVersion = ""
  // Порядок важен: Edge/Opera содержат слово Chrome в UA
  const browserRules: [RegExp, string][] = [
    [/edg(?:e|a|ios)?\/([\d.]+)/i, "Edge"],
    [/opr\/([\d.]+)|opera[ /]([\d.]+)/i, "Opera"],
    [/samsungbrowser\/([\d.]+)/i, "Samsung Internet"],
    [/yabrowser\/([\d.]+)/i, "Yandex Browser"],
    [/miuibrowser\/([\d.]+)/i, "Mi Browser"],
    [/firefox\/([\d.]+)|fxios\/([\d.]+)/i, "Firefox"],
    [/crios\/([\d.]+)/i, "Chrome iOS"],
    [/chrome\/([\d.]+)/i, "Chrome"],
    [/version\/([\d.]+).*safari/i, "Safari"],
    [/safari\//i, "Safari"],
    [/curl\/([\d.]+)/i, "curl"],
  ]
  for (const [re, name] of browserRules) {
    const m = ua.match(re)
    if (m) {
      browser = name
      browserVersion = (m[1] || m[2] || "").split(".")[0]
      break
    }
  }

  return { deviceType, model, os, osVersion, browser, browserVersion }
}

/** Собрать полный профиль устройства (вызывать только в браузере) */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === "undefined") return { ...UNKNOWN_DEVICE }
  try {
    const ua = navigator.userAgent || ""
    const parsed = parseUserAgent(ua)
    return {
      ...parsed,
      screenW: window.screen?.width ?? 0,
      screenH: window.screen?.height ?? 0,
      dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
      timezone: Intl.DateTimeFormat()?.resolvedOptions()?.timeZone || "",
      language: (navigator.language || "").split("-")[0],
      touch: "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0,
      cores: typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : null,
      memoryGb: typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === "number"
        ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory!
        : null,
      userAgent: ua.slice(0, 300),
    }
  } catch {
    return { ...UNKNOWN_DEVICE }
  }
}

/** Короткая подпись устройства для UI: «Pixel 8 · Android 14 · Chrome» */
export function deviceLabel(info: DeviceInfo): string {
  const parts = [info.model !== "unknown" ? info.model : "", info.os]
  if (info.osVersion) parts.push(`${info.os} ${info.osVersion}`)
  return parts.filter(Boolean).join(" · ")
}
