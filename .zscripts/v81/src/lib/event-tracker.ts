/**
 * EventTracker — трекинг игровых событий.
 * Отправляет на /api/events без блокировки UI (beacon).
 */

let visitorId = ""
let nickname = ""
let deviceType = ""

export function initEventTracker() {
  try {
    visitorId = localStorage.getItem("nastolka-visitor-id") || ""
    nickname = localStorage.getItem("nastolka-nickname") || ""
    const ua = navigator.userAgent
    const isMobile = /Mobile|iPhone|Android.*Mobile|Windows Phone/i.test(ua)
    const isTablet = /iPad|Tablet|Silk/i.test(ua) || (!isMobile && /Android/.test(ua))
    deviceType = isTablet ? "tablet" : isMobile ? "phone" : "desktop"
  } catch {}
}

/** Отправить событие на сервер */
export function trackEvent(eventType: string, data?: Record<string, unknown>) {
  try {
    const payload = JSON.stringify({
      visitorId,
      nickname,
      eventType,
      deviceType,
      pagePath: window.location.pathname,
      data,
    })
    const blob = new Blob([payload], { type: "application/json" })
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", blob)
    } else {
      fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {})
    }
  } catch {}
}

// Удобные методы для конкретных событий
export const events = {
  pageView: () => trackEvent("page_view"),
  diceRoll: (method?: string) => trackEvent("dice_roll", { method }),
  scored: (points: number, word: string, method: string) => trackEvent("scored", { points, word: word.slice(0, 20), method }),
  skipped: (word: string, method: string) => trackEvent("skipped", { word: word.slice(0, 20), method }),
  chipUsed: (chip: string) => trackEvent("chip_used", { chip }),
  gameStart: (teams: number, target: number) => trackEvent("game_start", { teams, target }),
  gameOver: (winner: string, scores: number[]) => trackEvent("game_over", { winner, scores }),
  wordShown: () => trackEvent("word_shown"),
  wordSwapped: () => trackEvent("word_swapped"),
  replayRound: () => trackEvent("replay_round"),
  mpConnect: (role: string, code: string) => trackEvent("mp_connect", { role, code }),
  mpDisconnect: () => trackEvent("mp_disconnect"),
  nicknameSet: (name: string) => trackEvent("nickname_set", { name }),
  themeChange: (theme: string) => trackEvent("theme_change", { theme }),
  langChange: (lang: string) => trackEvent("lang_change", { lang }),
  boardOpen: () => trackEvent("board_open"),
  boardClose: () => trackEvent("board_close"),
  hintUsed: () => trackEvent("hint_used"),
  undoRound: () => trackEvent("undo_round"),
}
