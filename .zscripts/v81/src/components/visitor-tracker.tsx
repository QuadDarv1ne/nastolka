"use client"

import { useEffect, useRef } from "react"

/**
 * VisitorTracker v66 — максимально подробная аналитика устройства.
 * Собирает 40+ характеристик: устройство, ОС, браузер, экран, GPU,
 * CPU, память, батарея, сеть, сенсоры, предпочтения, гео, и т.д.
 */

const VISITOR_ID_KEY = "nastolka-visitor-id"
const MIN_INTERVAL_MS = 30 * 1000

export function VisitorTracker() {
  const sentRef = useRef(false)
  useEffect(() => {
    if (sentRef.current) return
    sentRef.current = true

    try {
      const lastSent = localStorage.getItem("nastolka-analytics-last-sent")
      const now = Date.now()
      if (lastSent && now - parseInt(lastSent) < MIN_INTERVAL_MS) return
      localStorage.setItem("nastolka-analytics-last-sent", String(now))
    } catch {}

    collectAndSend()
  }, [])

  return null
}

async function collectAndSend() {
  const nav = navigator as any
  const scr = screen as any
  const ua = nav.userAgent || ""
  const nickname = safeGet("nastolka-nickname") || ""

  // ═══ Устройство ═══
  const isMobile = /Mobile|iPhone|Android.*Mobile|Windows Phone|BlackBerry/i.test(ua)
  const isTablet = /iPad|Tablet|Silk/i.test(ua) || (!isMobile && /Android/.test(ua))
  const deviceType = isTablet ? "tablet" : isMobile ? "phone" : "desktop"

  // Модель устройства (для мобильных)
  let deviceModel = "unknown"
  const iphoneMatch = ua.match(/iPhone(\d+,\d+)/)
  if (iphoneMatch) deviceModel = `iPhone${iphoneMatch[1]}`
  const androidMatch = ua.match(/Android;\s([^;)]+)/)
  if (androidMatch) deviceModel = androidMatch[1].trim()
  const ipadMatch = ua.match(/iPad/i)
  if (ipadMatch) deviceModel = "iPad"

  // ═══ ОС ═══
  let os = "unknown"
  let osVersion = "unknown"
  if (/Windows NT 10/.test(ua)) { os = "Windows"; osVersion = "10/11" }
  else if (/Windows NT 6\.3/.test(ua)) { os = "Windows"; osVersion = "8.1" }
  else if (/Windows NT 6\.1/.test(ua)) { os = "Windows"; osVersion = "7" }
  else if (/Mac OS X/.test(ua)) {
    os = "macOS"
    const m = ua.match(/Mac OS X (\d+[._]\d+[._]?\d*)/)
    osVersion = m ? m[1].replace(/_/g, ".") : "unknown"
  }
  else if (/Android/.test(ua)) {
    os = "Android"
    const m = ua.match(/Android (\d+(?:\.\d+)?)/)
    osVersion = m ? m[1] : "unknown"
  }
  else if (/iPhone|iPad/.test(ua)) {
    os = "iOS"
    const m = ua.match(/iPhone OS (\d+)/) || ua.match(/iPad.*OS (\d+)/)
    osVersion = m ? m[1] : "unknown"
  }
  else if (/CrOS/.test(ua)) { os = "ChromeOS"; osVersion = "unknown" }
  else if (/Linux/.test(ua)) { os = "Linux"; osVersion = "unknown" }

  // ═══ Браузер ═══
  let browser = "unknown"
  let browserVersion = ""
  if (/Edg\/(\d+)/.test(ua)) { browser = "Edge"; browserVersion = ua.match(/Edg\/(\d+(?:\.\d+)?)/)?.[1] || "" }
  else if (/OPR\/(\d+)/.test(ua) || /Opera/.test(ua)) { browser = "Opera"; browserVersion = ua.match(/OPR\/(\d+(?:\.\d+)?)/)?.[1] || "" }
  else if (/Firefox\/(\d+)/.test(ua)) { browser = "Firefox"; browserVersion = ua.match(/Firefox\/(\d+(?:\.\d+)?)/)?.[1] || "" }
  else if (/Chrome\/(\d+)/.test(ua) && !/Edg/.test(ua)) { browser = "Chrome"; browserVersion = ua.match(/Chrome\/(\d+(?:\.\d+)?)/)?.[1] || "" }
  else if (/Safari\/(\d+)/.test(ua) && !/Chrome/.test(ua)) { browser = "Safari"; browserVersion = ua.match(/Version\/(\d+(?:\.\d+)?)/)?.[1] || "" }

  let engine = "unknown"
  if (/Gecko/.test(ua) && !/WebKit/.test(ua)) engine = "Gecko"
  else if (/AppleWebKit/.test(ua)) engine = "WebKit"
  else if (/Blink/.test(ua)) engine = "Blink"

  // ═══ Экран ═══
  const screenResolution = `${scr.width}x${scr.height}`
  const availScreenSize = `${scr.availWidth}x${scr.availHeight}`
  const viewportSize = `${window.innerWidth}x${window.innerHeight}`
  const pixelRatio = window.devicePixelRatio || 1
  const colorDepth = scr.colorDepth || 24
  const colorGamut = (() => {
    try {
      if (window.matchMedia?.("(color-gamut: rec2020)").matches) return "rec2020"
      if (window.matchMedia?.("(color-gamut: p3)").matches) return "P3"
      if (window.matchMedia?.("(color-gamut: srgb)").matches) return "sRGB"
    } catch {}
    return "unknown"
  })()

  // Ориентация
  const orientation = scr.orientation?.type || (window.matchMedia?.("(orientation: portrait)").matches ? "portrait" : "landscape")

  // ═══ CPU / Память ═══
  const cpuCores = nav.hardwareConcurrency || 0
  const deviceMemory = nav.deviceMemory || 0

  // ═══ Батарея ═══
  let batteryLevel = ""
  let batteryCharging = false
  try {
    const bat = await nav.getBattery?.()
    if (bat) {
      batteryLevel = `${Math.round(bat.level * 100)}%`
      batteryCharging = bat.charging
    }
  } catch {}

  // ═══ Сеть ═══
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection
  const connectionType = connection?.effectiveType || connection?.type || "unknown"
  const downlink = connection?.downlink || 0
  const rtt = connection?.rtt || 0
  const saveData = connection?.saveData || false

  // ═══ Сенсоры ═══
  const touchSupport = "ontouchstart" in window
  const maxTouchPoints = nav.maxTouchPoints || 0
  const hasVibration = "vibrate" in navigator
  const hasGeolocation = "geolocation" in navigator
  const hasBluetooth = "bluetooth" in navigator
  const hasNFC = "nfc" in navigator
  const hasUSB = "usb" in navigator
  const hasCamera = "mediaDevices" in navigator
  const hasGamepad = "getGamepads" in navigator
  const hasWakeLock = "wakeLock" in navigator
  const hasShare = "share" in navigator
  const hasClipboard = "clipboard" in navigator
  const hasServiceWorker = "serviceWorker" in navigator
  const hasWebGL = (() => { try { return !!document.createElement("canvas").getContext("webgl") } catch { return false } })()

  // GPU
  let gpuVendor = "unknown"
  let gpuRenderer = "unknown"
  try {
    const canvas = document.createElement("canvas")
    const gl = canvas.getContext("webgl") as WebGLRenderingContext | null
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info")
      if (ext) {
        gpuVendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || "unknown"
        gpuRenderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "unknown"
      }
    }
  } catch {}

  // ═══ Преференсы ═══
  const prefersDarkMode = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  const prefersReducedTransparency = window.matchMedia?.("(prefers-reduced-transparency: reduce)").matches ?? false
  const prefersContrast = (() => {
    try {
      if (window.matchMedia?.("(prefers-contrast: more)").matches) return "more"
      if (window.matchMedia?.("(prefers-contrast: less)").matches) return "less"
    } catch {}
    return "normal"
  })()

  // ═══ Гео (клиент) ═══
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown"
  const timezoneOffset = new Date().getTimezoneOffset()

  // ═══ Прочее ═══
  const cookiesEnabled = nav.cookieEnabled
  const onlineStatus = nav.onLine
  const language = nav.language
  const languages = nav.languages ? nav.languages.join(",") : nav.language
  const platform = nav.platform || "unknown"
  const doNotTrack = nav.doNotTrack || "unknown"
  const pdfViewer = nav.pdfViewerEnabled ?? false
  const webdriver = nav.webdriver ?? false

  // ═══ Сборка данных ═══
  const data = {
    // Базовые
    sessionId: getVisitorId(),
    pageUrl: window.location.href,
    pagePath: window.location.pathname,
    nickname,
    // Устройство
    deviceType, deviceModel, userAgent: ua,
    // ОС
    os, osVersion,
    // Браузер
    browser, browserVersion, engine,
    // Экран
    screenResolution, availScreenSize, viewportSize, pixelRatio, colorDepth, colorGamut, orientation,
    // CPU / RAM
    cpuCores, deviceMemory,
    // Батарея
    batteryLevel, batteryCharging,
    // Сеть
    connectionType, downlink, rtt, saveData,
    // Сенсоры
    touchSupport, maxTouchPoints, hasVibration, hasGeolocation, hasBluetooth, hasNFC,
    hasUSB, hasCamera, hasGamepad, hasWakeLock, hasShare, hasClipboard,
    hasServiceWorker, hasWebGL,
    // GPU
    gpuVendor, gpuRenderer,
    // Преференсы
    prefersDarkMode, prefersReducedMotion, prefersReducedTransparency, prefersContrast,
    // Гео (клиент)
    timezone, timezoneOffset,
    // Прочее
    cookiesEnabled, onlineStatus, language, languages, platform, doNotTrack, pdfViewer, webdriver,
    // Старовое (для совместимости со старым API)
    screenResolution_legacy: screenResolution,
    viewportSize_legacy: viewportSize,
    pixelRatio_legacy: pixelRatio,
    colorDepth_legacy: colorDepth,
    cookiesEnabled_legacy: cookiesEnabled,
    onlineStatus_legacy: onlineStatus,
    language_legacy: language,
    languages_legacy: languages,
    platform_legacy: platform,
    touchSupport_legacy: touchSupport,
    maxTouchPoints_legacy: maxTouchPoints,
    connectionType_legacy: connectionType,
  }

  try {
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" })
    if (nav.sendBeacon) {
      nav.sendBeacon("/api/analytics", blob)
    } else {
      fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), keepalive: true }).catch(() => {})
    }
  } catch {}
}

function safeGet(key: string): string {
  try { return localStorage.getItem(key) || "" } catch { return "" }
}

function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY)
    if (!id) {
      id = `v-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      localStorage.setItem(VISITOR_ID_KEY, id)
    }
    return id
  } catch { return "unknown" }
}
