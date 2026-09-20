// Типы игрового состояния Настолки. Вынесены из page.tsx, чтобы избежать
// циклических импортов (page.tsx ↔ multiplayer.ts) и дать компонентам
// (game-board.tsx и др.) доступ к Team/State без импорта всей страницы.

import type { Method, MethodId, WordEntry, WordCategory, Difficulty } from "@/lib/game-data"

export type Phase =
  | "setup"      // настройка команд и стартовой цели
  | "ready"      // начало хода — ждём, когда бросим кубик
  | "rolling"    // кубик крутится
  | "method"     // кубик выпал, показываем способ — выбираем открыть слово или (если выпал Choice) — выбрать способ
  | "task"       // слово спрятано, ждём открыть
  | "countdown"  // отсчёт 3-2-1-Старт! перед открытием таймера
  | "playing"    // слово открыто, идёт таймер
  | "round_end"  // раунд закончился — показываем результат
  | "game_over"  // игра окончена — победитель

export interface Team {
  name: string
  color: string         // tailwind gradient like "from-rose-500 to-pink-600"
  textOnColor: string   // "text-white"
  emoji: string
  score: number
  /** Фишки команды — на всю игру */
  chips: TeamChips
}

/** Фишки команды: 2× x2, 1× +10 сек, 1× +5 сек, опционально 1× Кража хода */
export interface TeamChips {
  x2: number
  plus10: number
  plus5: number
  stealTurn: number    // 1 — если команде случайно выпала Кража хода, иначе 0
}

export function initialChips(): TeamChips {
  return { x2: 2, plus10: 1, plus5: 1, stealTurn: 0 }
}

export interface RoundHistoryEntry {
  team: number
  word: string
  /** Перевод для EN-локали; отсутствует в записях, сохранённых до появления переводов */
  wordEn?: string
  category: string
  method: MethodId
  result: "scored" | "skipped"
  secondsLeft: number
  roundSeconds: number
  points: number        // сколько очков начислено (0 если skipped)
  multiplier: number    // какой множитель был (1 или 2)
}

export interface State {
  phase: Phase
  teams: Team[]
  activeTeam: number
  targetScore: number
  roundSeconds: number
  currentMethod: Method | null
  chosenMethodForChoice: MethodId | null  // когда выпал "Выбор"
  currentWord: WordEntry | null
  wordRevealed: boolean
  secondsLeft: number
  lastRoundResult: "scored" | "skipped" | null
  lastRoundPoints: number
  lastRoundBasePoints: number  // очки без учёта множителя (для показа)
  lastRoundMultiplier: number  // множитель в последнем раунде
  multiplier: number            // активный множитель текущего раунда (1 или 2)
  recentWords: string[]
  winner: number | null
  history: RoundHistoryEntry[]
  swapsUsed: number
  paused: boolean
  enabledCategories: WordCategory[]   // выбранные категории на setup (пусто = все)
  enabledDifficulties: Difficulty[]   // выбранные сложности на setup (пусто = все)
  customWords: string[]                // пользовательские слова (одна строка = одно слово)
  stealTeam: number                    // номер команды, у которой есть фишка Кража хода (-1 = нет)
  stealJustUsed: boolean               // флажок — была ли только что использована кража (для UI)
  countdownSeconds: number             // отсчёт 3-2-1 перед началом раунда (0 = не активен)
}

export type Action =
  | { type: "START_GAME"; teams: Team[]; targetScore: number; roundSeconds: number; enabledCategories: WordCategory[]; enabledDifficulties: Difficulty[]; customWords: string[]; word: WordEntry; stealTeam: number }
  | { type: "ROLL" }
  | { type: "ROLL_RESULT"; method: Method; word: WordEntry }
  | { type: "CHOOSE_METHOD"; methodId: Exclude<MethodId, "choice" | "reroll">; word: WordEntry }
  | { type: "SHOW_WORD" }
  | { type: "REVEAL_WORD" }
  | { type: "START_COUNTDOWN" }
  | { type: "COUNTDOWN_TICK" }
  | { type: "COUNTDOWN_DONE" }
  | { type: "TICK" }
  | { type: "SCORE" }
  | { type: "SKIP" }
  | { type: "SWAP_WORD"; word: WordEntry }
  | { type: "USE_CHIP"; chip: "x2" | "plus10" | "plus5" }
  | { type: "STEAL_TURN" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "NEXT_TURN" }
  | { type: "REROLL" }
  | { type: "UNDO_ROUND" }
  | { type: "RESTART"; word: WordEntry; stealTeam: number }
  | { type: "BACK_TO_SETUP" }
  | { type: "HYDRATE"; state: State }

/** Активные фазы — идёт раунд, их нельзя восстановить из localStorage как есть */
export const ACTIVE_PHASES: Phase[] = ["rolling", "method", "task", "countdown", "playing"]

/** Фазы, из которых можно безопасно восстановить состояние при перезагрузке */
export const RESTORABLE_PHASES: Phase[] = ["ready", "round_end", "game_over"]
