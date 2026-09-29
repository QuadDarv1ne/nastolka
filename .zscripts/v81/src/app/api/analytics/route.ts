import { NextRequest, NextResponse } from "next/server"

/**
 * GET  /api/analytics       — получить всю статистику (для admin страницы)
 * POST /api/analytics       — записать визит от клиента
 *
 * Данные хранятся в JSON файле (простое решение без БД).
 * В production можно заменить на PostgreSQL/ClickHouse.
 */

interface VisitorData {
  timestamp: string
  ip: string
  forwardedFor?: string
  realIp?: string
  userAgent: string
  acceptLanguage: string
  referer: string
  // Гео
  country?: string; city?: string; region?: string; timezone?: string
  latitude?: string; longitude?: string
  // Устройство (сервер)
  deviceType: "mobile" | "tablet" | "desktop" | string
  os: string; browser: string; browserVersion: string; engine: string
  // От клиента — базовые
  screenResolution?: string; viewportSize?: string; pixelRatio?: number
  colorDepth?: number; cookiesEnabled?: boolean; onlineStatus?: boolean
  language?: string; languages?: string; platform?: string
  touchSupport?: boolean; maxTouchPoints?: number; connectionType?: string
  sessionId?: string; pageUrl?: string; pagePath?: string
  // v63
  nickname?: string; osVersion?: string; deviceModel?: string
  cpuCores?: number; deviceMemory?: number; battery?: string
  prefersDarkMode?: boolean; prefersReducedMotion?: boolean; clientTimezone?: string
  // v66 — расширенные
  availScreenSize?: string; colorGamut?: string; orientation?: string
  batteryLevel?: string; batteryCharging?: boolean
  downlink?: number; rtt?: number; saveData?: boolean
  hasVibration?: boolean; hasGeolocation?: boolean; hasBluetooth?: boolean
  hasNFC?: boolean; hasUSB?: boolean; hasCamera?: boolean; hasGamepad?: boolean
  hasWakeLock?: boolean; hasShare?: boolean; hasClipboard?: boolean
  hasServiceWorker?: boolean; hasWebGL?: boolean
  gpuVendor?: string; gpuRenderer?: string
  prefersReducedTransparency?: boolean; prefersContrast?: string
  timezoneOffset?: number; doNotTrack?: string; pdfViewer?: boolean; webdriver?: boolean
}

import { join } from "node:path"
const DATA_FILE = join(process.cwd(), "analytics-data.json")

// Определение типа устройства из User-Agent
function detectDevice(ua: string): "mobile" | "tablet" | "desktop" {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return "tablet"
  if (/Mobile|iPhone|Android.*Mobile|Windows Phone|BlackBerry|Opera Mini/i.test(ua)) return "mobile"
  return "desktop"
}

// Определение ОС
function detectOS(ua: string): string {
  if (/Windows NT 10/.test(ua)) return "Windows 10/11"
  if (/Windows NT 6\.3/.test(ua)) return "Windows 8.1"
  if (/Windows NT 6\.1/.test(ua)) return "Windows 7"
  if (/Windows/.test(ua)) return "Windows"
  if (/Mac OS X/.test(ua)) {
    const m = ua.match(/Mac OS X (\d+[._]\d+)/)
    return m ? `macOS ${m[1].replace(/_/g, ".")}` : "macOS"
  }
  if (/Android (\d+)/.test(ua)) {
    const m = ua.match(/Android (\d+(?:\.\d+)?)/)
    return m ? `Android ${m[1]}` : "Android"
  }
  if (/iPhone OS (\d+)/.test(ua)) {
    const m = ua.match(/iPhone OS (\d+)/)
    return m ? `iOS ${m[1]}` : "iOS"
  }
  if (/Linux/.test(ua)) return "Linux"
  if (/CrOS/.test(ua)) return "ChromeOS"
  return "Unknown"
}

// Определение браузера
function detectBrowser(ua: string): { browser: string; version: string; engine: string } {
  if (/Edg\/(\d+)/.test(ua)) {
    const m = ua.match(/Edg\/(\d+(?:\.\d+)?)/)
    return { browser: "Edge", version: m ? m[1] : "", engine: "Blink" }
  }
  if (/OPR\/(\d+)/.test(ua) || /Opera/.test(ua)) {
    const m = ua.match(/OPR\/(\d+(?:\.\d+)?)/)
    return { browser: "Opera", version: m ? m[1] : "", engine: "Blink" }
  }
  if (/Firefox\/(\d+)/.test(ua)) {
    const m = ua.match(/Firefox\/(\d+(?:\.\d+)?)/)
    return { browser: "Firefox", version: m ? m[1] : "", engine: "Gecko" }
  }
  if (/Chrome\/(\d+)/.test(ua) && !/Edg/.test(ua)) {
    const m = ua.match(/Chrome\/(\d+(?:\.\d+)?)/)
    return { browser: "Chrome", version: m ? m[1] : "", engine: "Blink" }
  }
  if (/Safari\/(\d+)/.test(ua) && !/Chrome/.test(ua)) {
    const m = ua.match(/Version\/(\d+(?:\.\d+)?)/)
    return { browser: "Safari", version: m ? m[1] : "", engine: "WebKit" }
  }
  return { browser: "Unknown", version: "", engine: "Unknown" }
}

/** IP-геолокация через бесплатный ip-api.com (без ключа, 45 req/min) */
async function getGeoFromIP(ip: string): Promise<{ country?: string; city?: string; region?: string; timezone?: string; latitude?: string; longitude?: string } | undefined> {
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip === "21.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
    return undefined
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,regionName,timezone,lat,lon&lang=ru`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return undefined
    const data = await res.json()
    if (data && data.country) {
      return {
        country: data.country,
        city: data.city,
        region: data.regionName,
        timezone: data.timezone,
        latitude: data.lat ? String(data.lat) : undefined,
        longitude: data.lon ? String(data.lon) : undefined,
      }
    }
  } catch {
    // timeout или ошибка — пропускаем
  }
  return undefined
}

async function readData(): Promise<VisitorData[]> {
  try {
    const fs = await import("node:fs/promises")
    const raw = await fs.readFile(DATA_FILE, "utf-8")
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function writeData(data: VisitorData[]): Promise<void> {
  try {
    const fs = await import("node:fs/promises")
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8")
  } catch (e) {
    console.error("[analytics] Failed to write:", e)
  }
}

export async function GET() {
  const data = await readData()

  // Статистика по времени (по часам за последние 24ч)
  const now = new Date()
  const byHour: Record<string, number> = {}
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 3600_000)
    const key = d.toISOString().slice(0, 13) // YYYY-MM-DDTHH
    byHour[key] = 0
  }
  for (const d of data) {
    const key = d.timestamp.slice(0, 13)
    if (key in byHour) byHour[key]++
  }

  // По путям страниц
  const byPage: Record<string, number> = {}
  for (const d of data) {
    if (d.pagePath) byPage[d.pagePath] = (byPage[d.pagePath] || 0) + 1
  }

  // По типу соединения
  const byConnection: Record<string, number> = {}

  const stats = {
    total: data.length,
    byDevice: {} as Record<string, number>,
    byOS: {} as Record<string, number>,
    byBrowser: {} as Record<string, number>,
    byCountry: {} as Record<string, number>,
    byCity: {} as Record<string, number>,
    byLanguage: {} as Record<string, number>,
    byNickname: {} as Record<string, number>,
    byDeviceType: {} as Record<string, number>,
    byTimezone: {} as Record<string, number>,
    byGpuVendor: {} as Record<string, number>,
    byConnectionType: {} as Record<string, number>,
    byOrientation: {} as Record<string, number>,
    byBatteryLevel: {} as Record<string, number>,
    byCpuCores: {} as Record<string, number>,
    byDeviceMemory: {} as Record<string, number>,
    byPage,
    byConnection,
    byHour,
    uniqueIPs: new Set(data.map((d) => d.ip)).size,
    uniqueSessions: new Set(data.map((d) => d.sessionId).filter(Boolean)).size,
    uniqueVisitors: new Set(data.map((d) => d.sessionId).filter(Boolean)).size,
    uniquePages: new Set(data.map((d) => d.pagePath).filter(Boolean)).size,
    recent: data.slice(-50).reverse(),
    all: data.slice(-500).reverse(),
  }
  for (const d of data) {
    stats.byDevice[d.deviceType] = (stats.byDevice[d.deviceType] || 0) + 1
    stats.byOS[d.os] = (stats.byOS[d.os] || 0) + 1
    stats.byBrowser[d.browser] = (stats.byBrowser[d.browser] || 0) + 1
    if (d.country) stats.byCountry[d.country] = (stats.byCountry[d.country] || 0) + 1
    if (d.city) stats.byCity[d.city] = (stats.byCity[d.city] || 0) + 1
    if (d.language) stats.byLanguage[d.language] = (stats.byLanguage[d.language] || 0) + 1
    if (d.connectionType) stats.byConnection[d.connectionType] = (stats.byConnection[d.connectionType] || 0) + 1
    if (d.nickname) stats.byNickname[d.nickname] = (stats.byNickname[d.nickname] || 0) + 1
    if (d.deviceType) stats.byDeviceType[d.deviceType] = (stats.byDeviceType[d.deviceType] || 0) + 1
    if (d.clientTimezone || d.timezone) stats.byTimezone[(d.clientTimezone || d.timezone)!] = (stats.byTimezone[(d.clientTimezone || d.timezone)!] || 0) + 1
    if (d.nickname) stats.byNickname[d.nickname] = (stats.byNickname[d.nickname] || 0) + 1
    if (d.deviceType) stats.byDeviceType[d.deviceType] = (stats.byDeviceType[d.deviceType] || 0) + 1
    if (d.gpuVendor) stats.byGpuVendor[d.gpuVendor] = (stats.byGpuVendor[d.gpuVendor] || 0) + 1
    if (d.connectionType) stats.byConnectionType[d.connectionType] = (stats.byConnectionType[d.connectionType] || 0) + 1
    if (d.orientation) stats.byOrientation[d.orientation] = (stats.byOrientation[d.orientation] || 0) + 1
    if (d.batteryLevel) stats.byBatteryLevel[d.batteryLevel] = (stats.byBatteryLevel[d.batteryLevel] || 0) + 1
    if (d.cpuCores) stats.byCpuCores[String(d.cpuCores)] = (stats.byCpuCores[String(d.cpuCores)] || 0) + 1
    if (d.deviceMemory) stats.byDeviceMemory[String(d.deviceMemory)] = (stats.byDeviceMemory[String(d.deviceMemory)] || 0) + 1
  }
  return NextResponse.json(stats)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const ua = req.headers.get("user-agent") || ""
    const { browser, version, engine } = detectBrowser(ua)
    
    const visitor: VisitorData = {
      timestamp: new Date().toISOString(),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
          req.headers.get("x-real-ip") || 
          "unknown",
      forwardedFor: req.headers.get("x-forwarded-for") || undefined,
      realIp: req.headers.get("x-real-ip") || undefined,
      userAgent: ua,
      acceptLanguage: req.headers.get("accept-language") || "",
      referer: req.headers.get("referer") || "",
      // Гео из заголовков (Cloudflare/Vercel/Amvera) или ip-api.com fallback
      country: req.headers.get("cf-ipcountry") ||
               req.headers.get("x-vercel-ip-country") ||
               req.headers.get("x-amvera-country") ||
               (await getGeoFromIP(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || ""))?.country ||
               undefined,
      city: req.headers.get("cf-ipcity") ||
            req.headers.get("x-vercel-ip-city") ||
            (await getGeoFromIP(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || ""))?.city ||
            undefined,
      region: req.headers.get("cf-ipregion") || 
              req.headers.get("x-vercel-ip-country-region") || 
              undefined,
      timezone: req.headers.get("cf-timezone") || 
                req.headers.get("x-vercel-ip-timezone") || 
                undefined,
      latitude: req.headers.get("cf-iplatitude") || 
                req.headers.get("x-vercel-ip-latitude") || 
                undefined,
      longitude: req.headers.get("cf-iplongitude") || 
                 req.headers.get("x-vercel-ip-longitude") || 
                 undefined,
      // Устройство
      deviceType: detectDevice(ua),
      os: detectOS(ua),
      browser,
      browserVersion: version,
      engine,
      // От клиента
      screenResolution: body.screenResolution,
      viewportSize: body.viewportSize,
      pixelRatio: body.pixelRatio,
      colorDepth: body.colorDepth,
      cookiesEnabled: body.cookiesEnabled,
      onlineStatus: body.onlineStatus,
      language: body.language,
      languages: body.languages,
      platform: body.platform,
      touchSupport: body.touchSupport,
      maxTouchPoints: body.maxTouchPoints,
      connectionType: body.connectionType,
      sessionId: body.sessionId,
      pageUrl: body.pageUrl,
      pagePath: body.pagePath,
      // Расширенные (v63)
      nickname: body.nickname,
      osVersion: body.osVersion,
      deviceModel: body.deviceModel,
      cpuCores: body.cpuCores,
      deviceMemory: body.deviceMemory,
      battery: body.battery,
      prefersDarkMode: body.prefersDarkMode,
      prefersReducedMotion: body.prefersReducedMotion,
      clientTimezone: body.timezone,
    }

    const data = await readData()

    // ── Дедупликация: одна запись на уникального посетителя + страницу ──
    // "Уникальный посетитель" = visitorId (localStorage, постоянный) + IP.
    // Если уже есть запись — обновляем timestamp (а не создаём новую).
    // Это убирает дубли от перезагрузок страницы в течение сессии.
    const visitorId = body.sessionId || "unknown"
    const pagePath = body.pagePath || "/"
    const existingIdx = data.findIndex(
      (d) => d.sessionId === visitorId && d.pagePath === pagePath
    )

    if (existingIdx >= 0) {
      // Обновляем существующую запись — свежий timestamp
      data[existingIdx] = { ...data[existingIdx], ...visitor, timestamp: new Date().toISOString() }
    } else {
      // Новая запись — добавляем
      data.push(visitor)
    }

    // Храним максимум 2000 уникальных записей
    if (data.length > 2000) data.splice(0, data.length - 2000)
    await writeData(data)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[analytics] POST error:", e)
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 })
  }
}
