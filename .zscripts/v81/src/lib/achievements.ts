// Глобальная статистика за все сессии. Хранится в localStorage.

export interface GlobalStats {
  totalGames: number
  totalWordsGuessed: number
  totalWordsSkipped: number
  totalRounds: number
  totalSwaps: number
  totalPoints: number
  bestRoundPoints: number
  longestGameRounds: number
  bestScore: number
  bestStreak: number
  lastPlayedAt: number
}

const STORAGE_KEY = "nastolka-global-stats-v1"

function defaultStats(): GlobalStats {
  return { totalGames: 0, totalWordsGuessed: 0, totalWordsSkipped: 0, totalRounds: 0, totalSwaps: 0, totalPoints: 0, bestRoundPoints: 0, longestGameRounds: 0, bestScore: 0, bestStreak: 0, lastPlayedAt: 0 }
}

export function loadGlobalStats(): GlobalStats {
  if (typeof window === "undefined") return defaultStats()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultStats()
    return { ...defaultStats(), ...JSON.parse(raw) }
  } catch { return defaultStats() }
}

function saveGlobalStats(stats: GlobalStats) {
  if (typeof window === "undefined") return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)) } catch {}
}

export function recordGameComplete(args: { rounds: number; scored: number; skipped: number; swaps: number; winnerScore: number; roundPoints: number[]; bestStreak: number }): GlobalStats {
  const prev = loadGlobalStats()
  const bestRoundPoints = Math.max(prev.bestRoundPoints, ...args.roundPoints, 0)
  const next: GlobalStats = {
    totalGames: prev.totalGames + 1,
    totalWordsGuessed: prev.totalWordsGuessed + args.scored,
    totalWordsSkipped: prev.totalWordsSkipped + args.skipped,
    totalRounds: prev.totalRounds + args.rounds,
    totalSwaps: prev.totalSwaps + args.swaps,
    totalPoints: prev.totalPoints + args.roundPoints.reduce((a, b) => a + b, 0),
    bestRoundPoints,
    longestGameRounds: Math.max(prev.longestGameRounds, args.rounds),
    bestScore: Math.max(prev.bestScore, args.winnerScore),
    bestStreak: Math.max(prev.bestStreak, args.bestStreak),
    lastPlayedAt: Date.now(),
  }
  saveGlobalStats(next)
  return next
}

export function resetGlobalStats(): GlobalStats {
  const empty = defaultStats()
  saveGlobalStats(empty)
  return empty
}

export function formatLastPlayed(ts: number): string {
  if (!ts) return ""
  try {
    return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
  } catch { return "" }
}
