/**
 * Общие типы игры Настолка — вынесены в отдельный файл,
 * чтобы избежать циклических импортов между page.tsx, multiplayer.ts, game-board.tsx и т.д.
 */

import type { Method, MethodId, WordEntry, WordCategory, Difficulty } from "./game-data"

export type Phase =
  | "setup"
  | "ready"
  | "rolling"
  | "method"
  | "task"
  | "countdown"
  | "playing"
  | "round_end"
  | "game_over"

export interface TeamChips {
  x2: number
  plus10: number
  plus5: number
  stealTurn: number
}

export function initialChips(): TeamChips {
  return { x2: 2, plus10: 1, plus5: 1, stealTurn: 0 }
}

export interface Team {
  name: string
  color: string
  textOnColor: string
  emoji: string
  score: number
  chips: TeamChips
  /** Текущая серия подряд успешных раундов (обнуляется при скипе/таймере) */
  streak: number
}

export interface RoundHistoryEntry {
  team: number
  word: string
  category: string
  method: MethodId
  result: "scored" | "skipped"
  secondsLeft: number
  roundSeconds: number
  points: number
  multiplier: number
}

export interface State {
  phase: Phase
  teams: Team[]
  activeTeam: number
  targetScore: number
  roundSeconds: number
  currentMethod: Method | null
  chosenMethodForChoice: MethodId | null
  currentWord: WordEntry | null
  wordRevealed: boolean
  secondsLeft: number
  lastRoundResult: "scored" | "skipped" | null
  lastRoundPoints: number
  lastRoundBasePoints: number
  lastRoundMultiplier: number
  /** Бонусные очки за серию, добавленные в этом раунде (0 если нет бонуса) */
  lastRoundStreakBonus?: number
  multiplier: number
  recentWords: string[]
  winner: number | null
  history: RoundHistoryEntry[]
  swapsUsed: number
  paused: boolean
  enabledCategories: WordCategory[]
  enabledDifficulties: Difficulty[]
  customWords: string[]
  stealTeam: number
  stealJustUsed: boolean
  countdownSeconds: number
  /** Мультиплеер: маппинг clientId → teamIdx (какой игрок за какую команду играет) */
  playerTeams?: Record<string, number>
}
