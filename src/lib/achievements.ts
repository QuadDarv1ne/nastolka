// Глобальная статистика за все сессии. Хранится в localStorage отдельно от
// состояния активной игры. Переживает перезагрузки, закрытие вкладки, новый
// запуск браузера.

import { readJson, writeJson } from "@/lib/storage"

export interface GlobalStats {
  totalGames: number       // сколько игр сыграно (до победы какой-то команды)
  totalWordsGuessed: number // сколько слов угадано всего
  totalWordsSkipped: number // сколько слов пропущено
  totalRounds: number       // сколько раундов сыграно
  totalSwaps: number        // сколько замен слова сделано
  totalPoints: number       // суммарные очки за все сессии
  bestRoundPoints: number   // рекорд: больше всего очков за один раунд
  // winsByTeam не имеет смысла — имена команд разные в разных играх.
  // Храним самая длинная игра и самая результативная победа:
  longestGameRounds: number // максимальное число раундов в одной игре
  bestScore: number          // максимальный финальный счёт победителя
  lastPlayedAt: number      // timestamp последней игры
}

const STORAGE_KEY = "nastolka-global-stats-v1"

function defaultStats(): GlobalStats {
  return {
    totalGames: 0,
    totalWordsGuessed: 0,
    totalWordsSkipped: 0,
    totalRounds: 0,
    totalSwaps: 0,
    totalPoints: 0,
    bestRoundPoints: 0,
    longestGameRounds: 0,
    bestScore: 0,
    lastPlayedAt: 0,
  }
}

/** Прочитать глобальную статистику из localStorage */
export function loadGlobalStats(): GlobalStats {
  if (typeof window === "undefined") return defaultStats()
  const parsed = readJson<Partial<GlobalStats>>(STORAGE_KEY)
  return { ...defaultStats(), ...parsed }
}

/** Сохранить глобальную статистику */
function saveGlobalStats(stats: GlobalStats) {
  if (typeof window === "undefined") return
  writeJson(STORAGE_KEY, stats)
}

/** Записать окончание одной игры.
 *  Принимает историю раундов, общее число замен и финальный счёт победителя.
 *  roundPoints — массив очков за каждый раунд (для рекорда лучший раунд).
 */
export function recordGameComplete(args: {
  rounds: number
  scored: number
  skipped: number
  swaps: number
  winnerScore: number
  roundPoints: number[]
}): GlobalStats {
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
    lastPlayedAt: Date.now(),
  }
  saveGlobalStats(next)
  return next
}

/** Полный сброс статистики (для кнопки Очистить достижения) */
export function resetGlobalStats(): GlobalStats {
  const empty = defaultStats()
  saveGlobalStats(empty)
  return empty
}

/** Человекочитаемая дата последней игры */
export function formatLastPlayed(ts: number): string {
  if (!ts) return "ещё не играли"
  try {
    const d = new Date(ts)
    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "ещё не играли"
  }
}
