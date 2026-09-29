"use client"

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import confetti from "canvas-confetti"
import {
  Dices, Type, Music, Brush, Hand, Sparkles, Trophy, Play, RotateCcw, AlertCircle, HelpCircle,
  Eye, EyeOff, Check, X, ChevronRight, Clock, Info, PartyPopper, ArrowRight,
  RefreshCw, Sun, Moon, Volume2, VolumeX, ListChecks, Pause, Award, Share2,
  Languages, Radio, Zap, Settings, Lightbulb,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  DICE_FACES, METHODS, SPECIAL_METHODS, CATEGORY_LABELS, DIFFICULTY_COLORS,
  METHOD_POINTS, DIFFICULTY_POINTS, getRoundPoints, getStreakBonus, isStreakMilestone, rollDie, WordPicker, WORDS, localizedWord,
  methodLabel as getMethodLabel,
  type Method, type MethodId, type WordEntry, type WordCategory, type Difficulty,
} from "@/lib/game-data"
import { Dice } from "@/components/dice"
import { DrawingCanvas } from "@/components/drawing-canvas"
import { SongRecorder } from "@/components/song-recorder"
import { AchievementsDialog } from "@/components/achievements-dialog"
import { MultiplayerDialog } from "@/components/multiplayer-dialog"
import { ChatPanel } from "@/components/chat-panel"
import { SettingsDialog } from "@/components/settings-dialog"
import { GameBoard } from "@/components/game-board"
import type { MultiplayerClient } from "@/lib/multiplayer"
import { getActiveRoomCode, type DeviceInfoOut } from "@/lib/multiplayer"

/** Генерирует уникальный ID устройства (хранится в localStorage) */
function getDeviceId(): string {
  try {
    let id = localStorage.getItem("nastolka-device-id")
    if (!id) {
      id = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem("nastolka-device-id", id)
    }
    return id
  } catch { return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }
}

/** Persistent visitor ID — переживает очистку отдельных ключей localStorage (для аналитики) */
function getVisitorId(): string {
  try {
    let id = localStorage.getItem("nastolka-visitor-id")
    if (!id) {
      id = `v-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      localStorage.setItem("nastolka-visitor-id", id)
    }
    return id
  } catch { return "unknown" }
}

/** Canvas-fingerprint — уникальный хеш отрисовки на canvas (устройство + GPU + драйвер) */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas")
    canvas.width = 280
    canvas.height = 60
    const ctx = canvas.getContext("2d")
    if (!ctx) return "no-canvas"
    // Специфичный текст с разными шрифтами — даёт разный результат на разных ОС/браузерах
    ctx.textBaseline = "top"
    ctx.font = "16px 'Arial'"
    ctx.fillStyle = "#f60"
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = "#069"
    ctx.fillText("Nastolka fingerprint 🔐", 2, 15)
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)"
    ctx.font = "11px 'Times New Roman'"
    ctx.fillText("device-id-secure", 4, 40)
    // Замеряем hash получившегося изображения
    const data = canvas.toDataURL()
    // Простой хеш FNV-1a
    let h = 0x811c9dc5
    for (let i = 0; i < data.length; i++) {
      h ^= data.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    return (h >>> 0).toString(16).padStart(8, "0")
  } catch { return "fp-error" }
}

/** WebGL-fingerprint — информация о видеокарте */
function getWebGLFingerprint(): { gpuVendor: string; gpuRenderer: string; webglHash: string } {
  try {
    const canvas = document.createElement("canvas")
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null
    if (!gl) return { gpuVendor: "n/a", gpuRenderer: "n/a", webglHash: "no-webgl" }
    const ext = gl.getExtension("WEBGL_debug_renderer_info")
    const vendor = ext ? (gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string) : (gl.getParameter(gl.VENDOR) as string)
    const renderer = ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : (gl.getParameter(gl.RENDERER) as string)
    // Доп. параметры для усиления fingerprint
    const params = [
      gl.getParameter(gl.VERSION),
      gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      gl.getParameter(gl.MAX_TEXTURE_SIZE),
      gl.getParameter(gl.MAX_VIEWPORT_DIMS),
      gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      gl.getParameter(gl.MAX_VARYING_VECTORS),
    ].join("|")
    let h = 0x811c9dc5
    for (let i = 0; i < params.length; i++) {
      h ^= params.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    return {
      gpuVendor: vendor || "unknown",
      gpuRenderer: renderer || "unknown",
      webglHash: (h >>> 0).toString(16).padStart(8, "0"),
    }
  } catch {
    return { gpuVendor: "n/a", gpuRenderer: "n/a", webglHash: "error" }
  }
}

/** Собирает характеристики устройства */
function getDeviceInfo(playerName?: string): Partial<DeviceInfoOut> {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
  const isMobile = /Mobile|iPhone|Android.*Mobile|Windows Phone/i.test(ua)
  const isTablet = /iPad|Tablet|Silk/i.test(ua) || (!isMobile && /Android/.test(ua))
  const deviceType = isTablet ? "tablet" : isMobile ? "phone" : "desktop"
  let os = "unknown"
  if (/Windows NT 10/.test(ua)) os = "Windows"
  else if (/Mac OS X/.test(ua)) os = "macOS"
  else if (/Android/.test(ua)) os = "Android"
  else if (/iPhone|iPad/.test(ua)) os = "iOS"
  else if (/Linux/.test(ua)) os = "Linux"
  let browser = "unknown"
  if (/Edg/.test(ua)) browser = "Edge"
  else if (/OPR|Opera/.test(ua)) browser = "Opera"
  else if (/Firefox/.test(ua)) browser = "Firefox"
  else if (/Chrome/.test(ua) && !/Edg/.test(ua)) browser = "Chrome"
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = "Safari"
  // Fingerprint — выполняется только на клиенте
  const canvasFp = typeof document !== "undefined" ? getCanvasFingerprint() : "ssr"
  const webglFp = typeof document !== "undefined" ? getWebGLFingerprint() : { gpuVendor: "ssr", gpuRenderer: "ssr", webglHash: "ssr" }
  return {
    deviceId: getDeviceId(),
    visitorId: getVisitorId(),
    deviceType, os, browser,
    screenResolution: typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "unknown",
    userAgent: ua,
    language: typeof navigator !== "undefined" ? navigator.language : "unknown",
    playerName,
    canvasFingerprint: canvasFp,
    gpuVendor: webglFp.gpuVendor,
    gpuRenderer: webglFp.gpuRenderer,
    webglFingerprint: webglFp.webglHash,
  }
}
import {
  isMuted, playCorrect, playDiceRoll, playSkip, playSwap, playTick, playTimeUp,
  playWin, playChipX2, playChipPlus10, playChipPlus5, playBigScore, playMilestone, playTeamActive, setMuted, unlockAudio,
  hapticRoll, hapticScore, hapticSkip, hapticChip, hapticWin, hapticTick,
} from "@/lib/sounds"
import { recordGameComplete } from "@/lib/achievements"
import { storage } from "@/lib/storage"
import { initEventTracker, events as track } from "@/lib/event-tracker"
import { useTheme } from "@/hooks/use-theme"
import { useLang } from "@/hooks/use-lang"
import { I18nContext, useI18n } from "@/hooks/i18n-context"
import { t, categoryLabel, difficultyLabel, type Lang, type StringKey } from "@/lib/i18n"

/* ────────────────────────────── Типы ────────────────────────────── */

type Phase = "setup" | "ready" | "rolling" | "method" | "task" | "countdown" | "playing" | "round_end" | "game_over"

interface Team {
  name: string; color: string; textOnColor: string; emoji: string; score: number; chips: TeamChips; streak: number
}
interface TeamChips { x2: number; plus10: number; plus5: number; stealTurn: number }
function initialChips(): TeamChips { return { x2: 2, plus10: 1, plus5: 1, stealTurn: 0 } }

interface RoundHistoryEntry {
  team: number; word: string; category: string; method: MethodId;
  result: "scored" | "skipped"; secondsLeft: number; roundSeconds: number;
  points: number; multiplier: number;
}

interface State {
  phase: Phase; teams: Team[]; activeTeam: number; targetScore: number; roundSeconds: number;
  currentMethod: Method | null; chosenMethodForChoice: MethodId | null;
  currentWord: WordEntry | null; wordRevealed: boolean; secondsLeft: number;
  lastRoundResult: "scored" | "skipped" | null; lastRoundPoints: number;
  lastRoundBasePoints: number; lastRoundMultiplier: number; lastRoundStreakBonus?: number; multiplier: number;
  recentWords: string[]; winner: number | null; history: RoundHistoryEntry[];
  swapsUsed: number; paused: boolean;
  enabledCategories: WordCategory[]; enabledDifficulties: Difficulty[]; customWords: string[];
  stealTeam: number; stealJustUsed: boolean;
  countdownSeconds: number;
  /** Мультиплеер: маппинг clientId → teamIdx */
  playerTeams?: Record<string, number>;
}

type Action =
  | { type: "START_GAME"; teams: Team[]; targetScore: number; roundSeconds: number; enabledCategories: WordCategory[]; enabledDifficulties: Difficulty[]; customWords: string[]; word: WordEntry; stealTeam: number }
  | { type: "ROLL" }
  | { type: "ROLL_RESULT"; method: Method; word: WordEntry }
  | { type: "CHOOSE_METHOD"; methodId: Exclude<MethodId, "choice" | "reroll">; word: WordEntry }
  | { type: "SHOW_WORD" } | { type: "REVEAL_WORD" } | { type: "TICK" }
  | { type: "SCORE" } | { type: "SKIP" } | { type: "SWAP_WORD"; word: WordEntry }
  | { type: "USE_CHIP"; chip: "x2" | "plus10" | "plus5" } | { type: "STEAL_TURN" } | { type: "REPLAY_ROUND" }
  | { type: "PAUSE" } | { type: "RESUME" } | { type: "NEXT_TURN" } | { type: "REROLL" }
  | { type: "START_COUNTDOWN" } | { type: "COUNTDOWN_TICK" } | { type: "COUNTDOWN_DONE" }
  | { type: "UNDO_ROUND" }
  | { type: "RESTART"; word: WordEntry; stealTeam: number }
  | { type: "BACK_TO_SETUP" } | { type: "HYDRATE"; state: State } | { type: "ASSIGN_TEAM"; clientId: string; teamIdx: number } | { type: "GAME_OVER_WINNER"; winner: number }

const STORAGE_PREFIX = "nastolka"
const STATE_STORAGE_KEY = `${STORAGE_PREFIX}-state-v1`
const SETTINGS_STORAGE_KEY = `${STORAGE_PREFIX}-settings-v1`

const initialState: State = {
  phase: "setup",
  teams: [
    { name: "Команда А", color: "from-rose-500 to-pink-600", textOnColor: "text-white", emoji: "🦊", score: 0, chips: initialChips(), streak: 0 },
    { name: "Команда Б", color: "from-emerald-500 to-teal-600", textOnColor: "text-white", emoji: "🐻", score: 0, chips: initialChips(), streak: 0 },
  ],
  activeTeam: 0, targetScore: 10, roundSeconds: 60,
  currentMethod: null, chosenMethodForChoice: null, currentWord: null, wordRevealed: false,
  secondsLeft: 60, lastRoundResult: null, lastRoundPoints: 0,
  lastRoundBasePoints: 0, lastRoundMultiplier: 1, multiplier: 1,
  recentWords: [], winner: null, history: [], swapsUsed: 0, paused: false,
  enabledCategories: [], enabledDifficulties: [], customWords: [],
  stealTeam: -1, stealJustUsed: false,
  countdownSeconds: 0,
}

const COLOR_OPTIONS: { name: { ru: string; en: string }; gradient: string; emoji: string }[] = [
  { name: { ru: "Розовый", en: "Pink" }, gradient: "from-rose-500 to-pink-600", emoji: "🦊" },
  { name: { ru: "Зелёный", en: "Green" }, gradient: "from-emerald-500 to-teal-600", emoji: "🐻" },
  { name: { ru: "Синий", en: "Blue" }, gradient: "from-sky-500 to-indigo-600", emoji: "🦄" },
  { name: { ru: "Оранжевый", en: "Orange" }, gradient: "from-amber-500 to-orange-600", emoji: "🐯" },
  { name: { ru: "Фиолетовый", en: "Violet" }, gradient: "from-violet-500 to-purple-600", emoji: "🦉" },
  { name: { ru: "Бирюзовый", en: "Cyan" }, gradient: "from-cyan-500 to-blue-500", emoji: "🐬" },
]

function getMethodForRound(state: State): Method | null {
  if (!state.currentMethod) return null
  if (state.currentMethod.id === "choice") return state.chosenMethodForChoice ? METHODS[state.chosenMethodForChoice] : state.currentMethod
  return state.currentMethod
}

/** Get the localized word for display, returns "—" if no word */
function displayWord(state: State, lang: Lang): string {
  return state.currentWord ? localizedWord(state.currentWord, lang) : "—"
}

function pluralPoints(n: number, lang: Lang): string {
  if (lang === "en") return n === 1 ? "point" : "points"
  if (n === 1) return "очко"
  const lastTwo = n % 100; if (lastTwo >= 11 && lastTwo <= 14) return "очков"
  const last = n % 10; if (last >= 2 && last <= 4) return "очка"
  return "очков"
}

function makeReducer() {
  return function reducer(state: State, action: Action): State {
    switch (action.type) {
      case "START_GAME": {
        const teamsWithSteal = action.teams.map((tm, i) => ({ ...tm, streak: 0, chips: { ...initialChips(), stealTurn: i === action.stealTeam ? 1 : 0 } }))
        return { ...initialState, phase: "ready", teams: teamsWithSteal, targetScore: action.targetScore, roundSeconds: action.roundSeconds, secondsLeft: action.roundSeconds, enabledCategories: action.enabledCategories, enabledDifficulties: action.enabledDifficulties, customWords: action.customWords, currentWord: action.word, activeTeam: 0, stealTeam: action.stealTeam }
      }
      case "ROLL": return { ...state, phase: "rolling", paused: false, currentWord: null, currentMethod: null, multiplier: 1 }
      case "ROLL_RESULT": {
        const method = action.method
        if (method.id === "reroll") return { ...state, phase: "method", currentMethod: method, currentWord: null, multiplier: 1 }
        return { ...state, phase: "method", currentMethod: method, currentWord: action.word, wordRevealed: false, chosenMethodForChoice: null, multiplier: 1 }
      }
      case "CHOOSE_METHOD": return { ...state, chosenMethodForChoice: action.methodId, currentWord: action.word, multiplier: 1 }
      case "SHOW_WORD": return { ...state, phase: "task", wordRevealed: false, paused: false, multiplier: 1 }
      case "REVEAL_WORD": return { ...state, phase: "playing", wordRevealed: true, secondsLeft: state.roundSeconds, paused: false, multiplier: 1 }
      case "START_COUNTDOWN": return { ...state, phase: "countdown", countdownSeconds: 3 }
      case "COUNTDOWN_TICK": {
        const next = state.countdownSeconds - 1
        if (next <= 0) return { ...state, phase: "playing", wordRevealed: true, secondsLeft: state.roundSeconds, paused: false, multiplier: 1, countdownSeconds: 0 }
        return { ...state, countdownSeconds: next }
      }
      case "COUNTDOWN_DONE": return { ...state, phase: "playing", wordRevealed: true, secondsLeft: state.roundSeconds, paused: false, multiplier: 1, countdownSeconds: 0 }
      case "USE_CHIP": {
        if (state.phase !== "playing") return state
        const team = state.activeTeam; const chips = state.teams[team].chips
        if (action.chip === "x2") { if (chips.x2 <= 0) return state; return { ...state, multiplier: 2, teams: state.teams.map((tm, i) => i === team ? { ...tm, chips: { ...tm.chips, x2: tm.chips.x2 - 1 } } : tm) } }
        if (action.chip === "plus10") { if (chips.plus10 <= 0) return state; return { ...state, secondsLeft: state.secondsLeft + 10, teams: state.teams.map((tm, i) => i === team ? { ...tm, chips: { ...tm.chips, plus10: tm.chips.plus10 - 1 } } : tm) } }
        if (action.chip === "plus5") { if (chips.plus5 <= 0) return state; return { ...state, secondsLeft: state.secondsLeft + 5, teams: state.teams.map((tm, i) => i === team ? { ...tm, chips: { ...tm.chips, plus5: tm.chips.plus5 - 1 } } : tm) } }
        return state
      }
      case "STEAL_TURN": {
        if (state.phase !== "round_end") return state
        const team = state.activeTeam; if (state.teams[team]?.chips.stealTurn <= 0) return state
        return { ...state, phase: "ready", teams: state.teams.map((tm, i) => i === team ? { ...tm, chips: { ...tm.chips, stealTurn: tm.chips.stealTurn - 1 } } : tm), stealTeam: -1, stealJustUsed: true, currentMethod: null, chosenMethodForChoice: null, currentWord: null, wordRevealed: false, secondsLeft: state.roundSeconds, lastRoundResult: null, lastRoundPoints: 0, lastRoundBasePoints: 0, lastRoundMultiplier: 1, multiplier: 1 }
      }
      case "PAUSE": { if (state.phase !== "playing") return state; return { ...state, paused: true } }
      case "RESUME": { if (state.phase !== "playing") return state; return { ...state, paused: false } }
      case "TICK": {
        if (state.phase !== "playing" || state.paused) return state
        const next = state.secondsLeft - 1
        if (next <= 0) {
          const team = state.activeTeam
          const newTeams = state.teams.map((tm, i) => i === team ? { ...tm, streak: 0 } : tm)
          return { ...state, teams: newTeams, secondsLeft: 0, phase: "round_end", lastRoundResult: "skipped", lastRoundPoints: 0, lastRoundBasePoints: 0, lastRoundMultiplier: 1, multiplier: 1, history: pushHistory(state, "skipped", 0, 1) }
        }
        return { ...state, secondsLeft: next }
      }
      case "SWAP_WORD": {
        track.wordSwapped()
        if (state.phase !== "playing" || !state.currentWord) return state
        return { ...state, currentWord: action.word, swapsUsed: state.swapsUsed + 1, recentWords: [...state.recentWords.slice(-29), state.currentWord.word] }
      }
      case "SCORE": {
        const team = state.activeTeam
        const basePoints = getRoundPoints(state.currentMethod, state.chosenMethodForChoice, state.currentWord)
        // Streak bonus: считается по НОВОЙ серии (после +1)
        const newStreak = state.teams[team].streak + 1
        const streakBonus = getStreakBonus(newStreak)
        const baseWithBonus = basePoints + streakBonus
        const points = baseWithBonus * state.multiplier
        const newScore = state.teams[team].score + points
        const newTeams = state.teams.map((tm, i) => i === team ? { ...tm, score: newScore, streak: newStreak } : tm)
        const winner = newScore >= state.targetScore ? team : null
        return { ...state, teams: newTeams, phase: winner === null ? "round_end" : "game_over", lastRoundResult: "scored", lastRoundPoints: points, lastRoundBasePoints: basePoints, lastRoundMultiplier: state.multiplier, lastRoundStreakBonus: streakBonus, multiplier: 1, recentWords: state.currentWord ? [...state.recentWords.slice(-29), state.currentWord.word] : state.recentWords, winner, history: pushHistory(state, "scored", points, state.multiplier) }
      }
      case "SKIP": {
        const team = state.activeTeam
        const newTeams = state.teams.map((tm, i) => i === team ? { ...tm, streak: 0 } : tm)
        return { ...state, teams: newTeams, phase: "round_end", lastRoundResult: "skipped", lastRoundPoints: 0, lastRoundBasePoints: 0, lastRoundMultiplier: 1, multiplier: 1, recentWords: state.currentWord ? [...state.recentWords.slice(-29), state.currentWord.word] : state.recentWords, history: pushHistory(state, "skipped", 0, 1) }
      }
      case "NEXT_TURN": {
        const nextTeam = (state.activeTeam + 1) % state.teams.length
        return { ...state, phase: "ready", activeTeam: nextTeam, currentMethod: null, chosenMethodForChoice: null, currentWord: null, wordRevealed: false, secondsLeft: state.roundSeconds, lastRoundResult: null, lastRoundPoints: 0, lastRoundBasePoints: 0, lastRoundMultiplier: 1, multiplier: 1, paused: false, stealJustUsed: false }
      }
      case "REROLL": return { ...state, phase: "rolling", currentMethod: null, currentWord: null, wordRevealed: false, multiplier: 1 }
      case "UNDO_ROUND": {
        track.undoRound()
        if (state.history.length === 0) return state
        const lastEntry = state.history[state.history.length - 1]
        // Восстанавливаем счёт команды и серию
        const newTeams = state.teams.map((tm, i) => i === lastEntry.team ? { ...tm, score: tm.score - lastEntry.points, streak: lastEntry.result === "scored" ? Math.max(0, tm.streak - 1) : tm.streak } : tm)
        // Возвращаемся к той же команде (чей раунд был отменён)
        const prevTeam = lastEntry.team
        // Убираем последнюю запись из истории
        const newHistory = state.history.slice(0, -1)
        // Возвращаем слово в пул (убираем из recent если оно там)
        const newRecent = state.recentWords.filter((w, idx) => idx !== state.recentWords.length - 1)
        // Возвращаем фишку stealTurn если она была использована в этом раунде
        const stealWasUsed = state.stealJustUsed && lastEntry.team === state.activeTeam
        const updatedTeams = stealWasUsed ? newTeams.map((tm, i) => i === prevTeam ? { ...tm, chips: { ...tm.chips, stealTurn: tm.chips.stealTurn + 1 } } : tm) : newTeams
        return {
          ...state,
          teams: updatedTeams,
          activeTeam: prevTeam,
          phase: "ready",
          history: newHistory,
          recentWords: newRecent,
          currentMethod: null,
          currentWord: null,
          wordRevealed: false,
          secondsLeft: state.roundSeconds,
          lastRoundResult: null,
          lastRoundPoints: 0,
          lastRoundStreakBonus: 0,
          multiplier: 1,
          stealJustUsed: false,
          stealTeam: stealWasUsed ? prevTeam : state.stealTeam,
          winner: null,
        }
      }
      case "RESTART": {
        return { ...initialState, phase: "ready", teams: state.teams.map((tm, i) => ({ ...tm, score: 0, chips: { ...initialChips(), stealTurn: i === action.stealTeam ? 1 : 0 }, streak: 0 })), targetScore: state.targetScore, roundSeconds: state.roundSeconds, secondsLeft: state.roundSeconds, enabledCategories: state.enabledCategories, enabledDifficulties: state.enabledDifficulties, customWords: state.customWords, currentWord: action.word, stealTeam: action.stealTeam }
      }
      case "ASSIGN_TEAM": {
        // Назначить команду игроку (clientId → teamIdx)
        const playerTeams = { ...(state.playerTeams || {}) }
        playerTeams[action.clientId] = action.teamIdx
        return { ...state, playerTeams }
      }
      case "GAME_OVER_WINNER": return { ...state, phase: "game_over", winner: action.winner }
      case "BACK_TO_SETUP": return { ...initialState }
      case "HYDRATE": return action.state
      default: return state
    }
  }
}

function pushHistory(state: State, result: "scored" | "skipped", points = 0, multiplier = 1): RoundHistoryEntry[] {
  if (!state.currentWord) return state.history
  const method = getMethodForRound(state); if (!method) return state.history
  const entry: RoundHistoryEntry = { team: state.activeTeam, word: state.currentWord.word, category: state.currentWord.category, method: method.id, result, secondsLeft: state.secondsLeft, roundSeconds: state.roundSeconds, points, multiplier }
  return [...state.history, entry]
}

/* ────────────────────────────── HeaderBar ────────────────────────────── */

function HeaderBar({ onShowRules, onShowHistory, onShowAchievements, onShowMultiplayer, onShowSettings, hasHistory, multiplayerStatus, lang, onToggleLang, activeTeam, isMpActive, mpPlayerTeam, teams, phase, opponentOffline }: { onShowRules: () => void; onShowHistory: () => void; onShowAchievements: () => void; onShowMultiplayer: () => void; onShowSettings: () => void; hasHistory: boolean; multiplayerStatus: "disconnected" | "connecting" | "connected" | "error"; lang: Lang; onToggleLang: () => void; activeTeam?: number; isMpActive?: boolean; mpPlayerTeam?: number; teams?: Team[]; phase?: string; opponentOffline?: boolean }) {
  const { theme, toggle } = useTheme()
  const [muted, setMutedState] = useState(false)
  useEffect(() => { setMuted(isMuted()) }, [])
  const toggleMute = () => { const next = !muted; setMutedState(next); setMuted(next); if (!next) unlockAudio() }
  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    const shareText = t(lang, "shareText")
    try { if (navigator.share) await navigator.share({ title: t(lang, "appName"), text: shareText, url }); else { await navigator.clipboard.writeText(`${shareText} ${url}`); alert(t(lang, "shareCopied")) } } catch {}
  }
  return (
    <header className="w-full max-w-6xl px-4 pt-6">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Nastolka brand logo: red tile (rhombus) with dice dots + NASTOLKA wordmark */}
          <div className="flex items-center gap-2">
            <div className="nastolka-logo-tile" aria-hidden>
              <div className="nastolka-logo-tile-dots">
                <span></span><span></span><span></span>
                <span></span><span></span><span></span>
                <span></span><span></span><span></span>
              </div>
            </div>
            <div>
              <h1 className="nastolka-logo-text text-xl font-black leading-none tracking-tight sm:text-3xl">
                NAS<span className="inline-block" style={{ width: '0.4em' }}>·</span>TOLKA
              </h1>
              <p className="hidden text-xs text-muted-foreground sm:block sm:text-sm">{t(lang, "appSubtitle")}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* ── Индикатор «чей ход» в мультиплеере ── */}
          {isMpActive && teams && activeTeam !== undefined && phase && phase !== "setup" && phase !== "game_over" && (
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
              mpPlayerTeam === activeTeam
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
            }`}>
              <span className="text-base">{teams[activeTeam]?.emoji || "?"}</span>
              <span className="hidden sm:inline">
                {mpPlayerTeam === -2
                  ? (lang === "ru" ? "Подключение…" : "Connecting…")
                  : mpPlayerTeam === activeTeam
                  ? (lang === "ru" ? "Ваш ход!" : "Your turn!")
                  : (lang === "ru" ? `Ход: ${teams[activeTeam]?.name || ""}` : `Turn: ${teams[activeTeam]?.name || ""}`)
                }
              </span>
              <span className="sm:hidden">{mpPlayerTeam === -2 ? "⏳" : mpPlayerTeam === activeTeam ? "▶" : "⏳"}</span>
            </div>
          )}
          {/* ── Статус соперника: онлайн/офлайн ── */}
          {isMpActive && teams && (
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              opponentOffline ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            }`}>
              <span className={`h-2 w-2 rounded-full ${opponentOffline ? "bg-rose-500" : "bg-emerald-500 animate-pulse"}`} />
              <span className="hidden sm:inline">{opponentOffline ? t(lang, "mpOpponentOffline") : t(lang, "mpOpponentOnline")}</span>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={onShowMultiplayer} aria-label="Multiplayer"><Radio className={`h-4 w-4 ${multiplayerStatus === "connected" ? "text-emerald-500" : ""}`} /></Button>
          <Button variant="ghost" size="sm" onClick={onToggleLang} aria-label="Change language"><Languages className="h-4 w-4" /><span className="ml-0.5 text-[10px] font-bold uppercase">{lang}</span></Button>
          <Button variant="ghost" size="sm" onClick={onShowAchievements} aria-label={t(lang, "achievements")}><Award className="h-4 w-4" /></Button>
          {hasHistory && <Button variant="ghost" size="sm" onClick={onShowHistory} aria-label={t(lang, "historyFull")}><ListChecks className="h-4 w-4" /><span className="ml-1 hidden sm:inline">{t(lang, "history")}</span></Button>}
          <Button variant="ghost" size="sm" onClick={handleShare} aria-label={t(lang, "share")}><Share2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={toggleMute} aria-label={muted ? t(lang, "unmute") : t(lang, "mute")}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</Button>
          <Button variant="ghost" size="sm" onClick={onShowSettings} aria-label="Settings"><Settings className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={toggle} aria-label={t(lang, "themeDark")}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
          <Button variant="outline" size="sm" onClick={onShowRules} aria-label={t(lang, "rules")}><Info className="mr-1 h-4 w-4" /><span className="hidden sm:inline">{t(lang, "rules")}</span></Button>
        </div>
      </div>
    </header>
  )
}

/* ────────────────────────────── TeamScoreCard ────────────────────────────── */

function TeamScoreCard({ team, active, target }: { team: Team; active: boolean; target: number }) {
  const { t } = useI18n()
  // Отслеживаем изменение очков для всплывающего «+N»
  const prevScoreRef = useRef(team.score)
  const [delta, setDelta] = useState<{ value: number; key: number } | null>(null)
  useEffect(() => {
    const diff = team.score - prevScoreRef.current
    if (diff > 0) {
      setDelta({ value: diff, key: Date.now() })
      const tid = setTimeout(() => setDelta(null), 1500)
      prevScoreRef.current = team.score
      return () => clearTimeout(tid)
    }
    prevScoreRef.current = team.score
  }, [team.score])
  return (
    <motion.div animate={active ? { scale: 1.04 } : { scale: 1 }} transition={{ type: "spring", stiffness: 220, damping: 18 }} className={`team-card relative flex-1 overflow-hidden rounded-3xl bg-gradient-to-br ${team.color} p-5 text-white shadow-xl ${active ? "pulse-active" : ""}`}>
      {/* Пульсирующее свечение для активной команды */}
      {active && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-3xl"
          animate={{ boxShadow: ["0 0 0 0 rgba(255,255,255,0.5)", "0 0 0 12px rgba(255,255,255,0)"] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <div className="absolute -right-6 -top-6 select-none text-[7rem] opacity-25">{team.emoji}</div>
      {/* Индикатор серии 🔥 — показывается при streak >= 2 */}
      {team.streak >= 2 && (
        <motion.div
          key={team.streak}
          initial={{ opacity: 0, scale: 0.5, rotate: -15 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 14 }}
          className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-2 py-1 text-xs font-black uppercase tracking-wider shadow-lg"
        >
          <motion.span
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
          >
            🔥
          </motion.span>
          <span className="tabular-nums">×{team.streak}</span>
        </motion.div>
      )}
      <div className="relative z-10">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider opacity-90">
          {active && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center gap-1 rounded-full bg-white/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm"
            >
              <motion.span
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.4, 1] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                className="h-1.5 w-1.5 rounded-full bg-white"
              />
              {t("yourTurn")}
            </motion.span>
          )}
          <span className="truncate">{team.name}</span>
        </div>
        <div className="relative mt-2 flex items-end gap-2">
          <motion.div
            key={team.score}
            initial={{ scale: 1.4, color: "#fde68a" }}
            animate={{ scale: 1, color: "#ffffff" }}
            transition={{ type: "spring", stiffness: 280, damping: 14 }}
            className="text-5xl font-black leading-none drop-shadow-md"
          >
            {team.score}
          </motion.div>
          <div className="pb-1 text-sm font-medium opacity-80">/ {target}</div>
          {/* Всплывающее +N при изменении счёта */}
          <AnimatePresence>
            {delta && (
              <motion.div
                key={delta.key}
                initial={{ opacity: 0, y: 0, scale: 0.8 }}
                animate={{ opacity: 1, y: -28, scale: 1.2 }}
                exit={{ opacity: 0, y: -50 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="absolute right-0 top-0 text-2xl font-black text-amber-300 drop-shadow-md"
              >
                +{delta.value}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/20"><motion.div className="h-full rounded-full bg-white/90" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (team.score / target) * 100)}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} /></div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-90">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-1.5 py-0.5">×2 × {team.chips.x2}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-1.5 py-0.5">+10s × {team.chips.plus10}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-1.5 py-0.5">+5s × {team.chips.plus5}</span>
          {team.chips.stealTurn > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-700 px-1.5 py-0.5 font-bold">🎲 {t("stealActivateShort")}</span>}
        </div>
      </div>
    </motion.div>
  )
}

/* ────────────────────────────── PointsBadge ────────────────────────────── */

function PointsBadge({ state }: { state: State }) {
  const { t, lang } = useI18n()
  const method = getMethodForRound(state); if (!method || !state.currentWord) return null
  let methodId: MethodId = method.id
  if (method.id === "choice" && state.chosenMethodForChoice) methodId = state.chosenMethodForChoice
  if (methodId === "reroll") return null
  const m = METHOD_POINTS[methodId as Exclude<MethodId, "choice" | "reroll">] ?? 0
  const d = DIFFICULTY_POINTS[state.currentWord.difficulty ?? "medium"] ?? 0
  // Потенциальный бонус серии: если команда угадает сейчас, streak увеличится на 1
  const projectedStreak = (state.teams[state.activeTeam]?.streak ?? 0) + 1
  const potentialBonus = getStreakBonus(projectedStreak)
  const total = (m + d + potentialBonus) * state.multiplier
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow">
      {t("forAnswerLabel")} {total} {pluralPoints(total, lang)}
      {state.multiplier > 1 && <span className="opacity-90">×{state.multiplier}</span>}
      {potentialBonus > 0 && (
        <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-black uppercase" title={t("streakBonusLabel")}>
          🔥+{potentialBonus}
        </span>
      )}
    </span>
  )
}

/* ────────────────────────────── ChipsBar ────────────────────────────── */

function ChipsBar({ state, dispatch, isMpGuestLocked }: { state: State; dispatch: (a: Action) => void; isMpGuestLocked?: boolean }) {
  const { t, lang } = useI18n()
  const chips = state.teams[state.activeTeam]?.chips; if (!chips) return null
  const disabled = state.paused || isMpGuestLocked; const x2Used = state.multiplier > 1
  const handleChip = (chip: "x2" | "plus10" | "plus5") => {
    track.chipUsed(chip)
    if (chip === "x2") { playChipX2(); hapticChip() } else if (chip === "plus10") { playChipPlus10(); hapticChip() } else if (chip === "plus5") { playChipPlus5(); hapticChip() }
    dispatch({ type: "USE_CHIP", chip })
  }
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
      <ChipButton label="×2" sublabel={t("chipDouble")} count={chips.x2} disabled={disabled || x2Used || chips.x2 <= 0} active={x2Used} onClick={() => handleChip("x2")} color="bg-gradient-to-br from-fuchsia-500 to-pink-600" lang={lang} />
      <ChipButton label={`+10 ${t("secShort")}`} sublabel={t("chipTime")} count={chips.plus10} disabled={disabled || chips.plus10 <= 0} onClick={() => handleChip("plus10")} color="bg-gradient-to-br from-sky-500 to-cyan-600" lang={lang} />
      <ChipButton label={`+5 ${t("secShort")}`} sublabel={t("chipTime")} count={chips.plus5} disabled={disabled || chips.plus5 <= 0} onClick={() => handleChip("plus5")} color="bg-gradient-to-br from-indigo-500 to-blue-600" lang={lang} />
    </div>
  )
}

function ChipButton({ label, sublabel, count, disabled, active, onClick, color, lang }: { label: string; sublabel: string; count: number; disabled?: boolean; active?: boolean; onClick: () => void; color: string; lang: Lang }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`chip-button relative inline-flex flex-col items-center rounded-xl ${color} px-3 py-1.5 text-white shadow transition ${disabled ? "opacity-30 cursor-not-allowed" : "hover:scale-105 active:scale-95"} ${active ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""}`} aria-label={`${label} — ${lang === "ru" ? "осталось" : "left"} ${count}`}>
      <span className="text-xs font-black leading-none">{label}</span><span className="text-[10px] font-medium uppercase tracking-wider opacity-90">{sublabel}</span>
      {count > 0 && !disabled && !active && <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] font-black text-foreground shadow">{count}</span>}
    </button>
  )
}

/* ────────────────────────────── Timer ────────────────────────────── */

function Timer({ secondsLeft, total, paused = false }: { secondsLeft: number; total: number; paused?: boolean }) {
  const { t } = useI18n()
  const danger = secondsLeft <= 10
  const critical = secondsLeft <= 5
  const pct = (secondsLeft / total) * 100
  return (
    <div className="w-full pr-24">
      <div className="mb-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground"><Clock className={`h-4 w-4 ${paused ? "" : "animate-pulse"}`} />{paused ? t("pause") : t("time")}</div>
        <motion.div
          className={`font-mono text-lg font-black tabular-nums ${critical && !paused ? "text-rose-500" : danger && !paused ? "text-amber-500" : ""} ${paused ? "text-muted-foreground" : ""}`}
          animate={
            critical && !paused
              ? { scale: [1, 1.25, 1], opacity: [1, 0.7, 1] }
              : { scale: 1, opacity: 1 }
          }
          transition={
            critical
              ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.2 }
          }
        >
          {secondsLeft} {t("secShort")}
        </motion.div>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className={`h-full rounded-full ${
            critical ? "bg-gradient-to-r from-rose-500 to-red-600"
            : danger ? "bg-gradient-to-r from-amber-500 to-rose-500"
            : "bg-gradient-to-r from-emerald-500 to-teal-500"
          } ${paused ? "opacity-40" : ""}`}
          initial={{ width: "100%" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
        {/* Glow effect при critical */}
        {critical && !paused && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            style={{
              boxShadow: "0 0 12px 2px rgba(244, 63, 94, 0.7)",
            }}
          />
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────── FloatingBubbles ────────────────────────────── */

function FloatingBubbles() {
  const bubbles = useMemo(() => Array.from({ length: 12 }).map((_, i) => ({ id: i, left: `${(i * 8.3 + 5) % 100}%`, size: 18 + ((i * 7) % 60), duration: 14 + ((i * 3) % 12), delay: -(i * 1.7), hue: ["#f472b6", "#34d399", "#a78bfa", "#fbbf24", "#60a5fa"][i % 5] })), [])
  return <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">{bubbles.map((b) => <span key={b.id} className="bubble" style={{ left: b.left, width: b.size, height: b.size, animationDuration: `${b.duration}s`, animationDelay: `${b.delay}s`, background: `radial-gradient(circle at 30% 30%, ${b.hue}66, ${b.hue}22)`, bottom: -80 }} />)}</div>
}

/* ────────────────────────────── SetupScreen ────────────────────────────── */

function SetupScreen({ initialTeams, initialTarget, initialRound, initialCategories, initialDifficulties, initialCustomWords, onStart }: { initialTeams: Team[]; initialTarget: number; initialRound: number; initialCategories: WordCategory[]; initialDifficulties: Difficulty[]; initialCustomWords: string; onStart: (teams: Team[], target: number, roundSeconds: number, enabledCategories: WordCategory[], enabledDifficulties: Difficulty[], customWords: string[]) => void }) {
  const { t, lang } = useI18n()
  const [teamCount, setTeamCount] = useState(Math.min(4, Math.max(2, initialTeams.length)))
  const [teams, setTeams] = useState<Team[]>(() => {
    const defaults: Team[] = [
      { name: t("teamA"), color: "from-rose-500 to-pink-600", textOnColor: "text-white", emoji: "🦊", score: 0, chips: initialChips(), streak: 0 },
      { name: t("teamB"), color: "from-emerald-500 to-teal-600", textOnColor: "text-white", emoji: "🐻", score: 0, chips: initialChips(), streak: 0 },
      { name: t("teamV"), color: "from-sky-500 to-indigo-600", textOnColor: "text-white", emoji: "🦄", score: 0, chips: initialChips(), streak: 0 },
      { name: t("teamG"), color: "from-amber-500 to-orange-600", textOnColor: "text-white", emoji: "🐯", score: 0, chips: initialChips(), streak: 0 },
    ]
    const merged = [...defaults]; for (let i = 0; i < Math.min(4, initialTeams.length); i++) merged[i] = { ...defaults[i], ...initialTeams[i] }
    return merged
  })
  const [target, setTarget] = useState(initialTarget)
  const [round, setRound] = useState(initialRound)
  const [enabledCategories, setEnabledCategories] = useState<WordCategory[]>(initialCategories)
  const [enabledDifficulties, setEnabledDifficulties] = useState<Difficulty[]>(initialDifficulties)
  const [customWordsText, setCustomWordsText] = useState(initialCustomWords)
  const [showCustomWords, setShowCustomWords] = useState(false)
  const setTeamAt = (i: number, tm: Team) => setTeams((prev) => prev.map((x, idx) => idx === i ? tm : x))
  const visibleTeams = teams.slice(0, teamCount)
  const usedColors = (i: number) => visibleTeams.filter((_, idx) => idx !== i).map((tm) => tm.color)
  const toggleCategory = (c: WordCategory) => setEnabledCategories((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])
  const toggleDifficulty = (d: Difficulty) => setEnabledDifficulties((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])
  const allCategories = Object.keys(CATEGORY_LABELS) as WordCategory[]
  const allDifficulties: Difficulty[] = ["easy", "medium", "hard"]

  return (
    <div className="w-full max-w-3xl px-4">
      <Card className="setup-card p-6 shadow-xl sm:p-8">
        <div className="space-y-6">
          <div><h2 className="text-xl font-bold sm:text-2xl">{t("setupTitle")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("setupDescription")}</p></div>
          <div><Label className="mb-2 block">{t("teamCount")}</Label><div className="flex flex-wrap gap-2">{[2, 3, 4].map((n) => <Button key={n} type="button" variant={teamCount === n ? "default" : "outline"} onClick={() => setTeamCount(n)} className="flex-1">{n === 2 ? t("twoTeams") : n === 3 ? t("threeTeams") : t("fourTeams")}</Button>)}</div></div>
          <div className="space-y-3">
            {visibleTeams.map((team, i) => (
              <div key={i} className={`rounded-2xl bg-gradient-to-br ${team.color} p-[2px] shadow-md`}>
                <div className="rounded-2xl bg-card p-4">
                  <div className="mb-3 flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br text-2xl"><span>{team.emoji}</span></div><span className="font-semibold text-muted-foreground">{t("teamA").split(" ")[0]} {["А", "Б", "В", "Г"][i]}</span></div>
                  <Input value={team.name} maxLength={28} placeholder={t("teamNamePlaceholder")} onChange={(e) => setTeamAt(i, { ...team, name: e.target.value })} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((c) => { const selected = team.color === c.gradient; const disabled = usedColors(i).includes(c.gradient); return (
                      <button key={c.gradient} type="button" disabled={disabled} onClick={() => setTeamAt(i, { ...team, color: c.gradient, emoji: c.emoji })} className={`relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-xl shadow transition ${c.gradient} ${disabled ? "opacity-30 cursor-not-allowed" : "hover:scale-110"} ${selected ? "ring-4 ring-offset-2 ring-offset-card ring-foreground/40" : ""}`} aria-label={c.name[lang]}>{c.emoji}</button>
                    ); })}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><Label className="mb-2 block">{t("targetScore")}</Label><div className="flex flex-wrap gap-2">{[5, 10, 15, 20, 30].map((v) => <Button key={v} type="button" variant={target === v ? "default" : "outline"} onClick={() => setTarget(v)} className="flex-1">{v} {t("pointsShort")}</Button>)}</div></div>
            <div><Label className="mb-2 block">{t("roundTime")}</Label><div className="flex flex-wrap gap-2">{[30, 45, 60, 90].map((v) => <Button key={v} type="button" variant={round === v ? "default" : "outline"} onClick={() => setRound(v)} className="flex-1">{v} {t("secShort")}</Button>)}</div></div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2"><Label>{t("categories")}</Label><button type="button" onClick={() => setEnabledCategories([])} className="text-xs font-medium text-muted-foreground underline hover:text-foreground">{enabledCategories.length === 0 ? t("allCategories") : t("selectAll")}</button></div>
            {(() => {
              const itCategories: WordCategory[] = ["it_architecture", "it_processing", "it_theory", "it_programming", "it_security", "it_internet", "it_ai"]
              const generalCategories = allCategories.filter((c) => !itCategories.includes(c))
              const renderChip = (c: WordCategory) => {
                const active = enabledCategories.length === 0 || enabledCategories.includes(c)
                return <button key={c} type="button" onClick={() => toggleCategory(c)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>{categoryLabel(lang, c)}</button>
              }
              const groupHeader = (label: string) => (
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <span className="inline-block h-px w-4 bg-muted-foreground/40" />
                  {label}
                  <span className="inline-block h-px flex-1 bg-muted-foreground/40" />
                </div>
              )
              return (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-muted/20 p-3">
                    <div className="mb-2">{groupHeader(t("generalCategoriesGroup"))}</div>
                    <div className="flex flex-wrap gap-1.5">{generalCategories.map(renderChip)}</div>
                  </div>
                  <div className="rounded-2xl border border-dashed border-foreground/20 bg-muted/30 p-3">
                    <div className="mb-2">{groupHeader(t("itCategoriesGroup"))}</div>
                    <div className="flex flex-wrap gap-1.5">{itCategories.map(renderChip)}</div>
                  </div>
                </div>
              )
            })()}
            <p className="mt-1.5 text-xs text-muted-foreground">{enabledCategories.length === 0 ? t("allCategoriesHint") : `${t("categoriesSelected")} ${enabledCategories.length}`}</p>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2"><Label>{t("difficulty")}</Label><button type="button" onClick={() => setEnabledDifficulties([])} className="text-xs font-medium text-muted-foreground underline hover:text-foreground">{enabledDifficulties.length === 0 ? t("allCategories") : t("selectAll")}</button></div>
            <div className="flex flex-wrap gap-1.5">{allDifficulties.map((d) => { const active = enabledDifficulties.length === 0 || enabledDifficulties.includes(d); return <button key={d} type="button" onClick={() => toggleDifficulty(d)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? DIFFICULTY_COLORS[d] : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>{difficultyLabel(lang, d)}</button> })}</div>
            <p className="mt-1.5 text-xs text-muted-foreground">{enabledDifficulties.length === 0 ? t("allDifficultiesHint") : `${t("difficultiesSelected")} ${enabledDifficulties.length}`}</p>
          </div>
          {/* Счётчик доступных слов */}
          {(() => {
            let pool = WORDS
            if (enabledCategories.length > 0) pool = pool.filter((w) => enabledCategories.includes(w.category))
            if (enabledDifficulties.length > 0) pool = pool.filter((w) => enabledDifficulties.includes((w.difficulty ?? "medium") as Difficulty))
            const customCount = customWordsText.split("\n").map((s) => s.trim()).filter(Boolean).length
            const total = pool.length + customCount
            return <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-3 text-center dark:from-emerald-950/20 dark:to-teal-950/20"><span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{lang === "ru" ? `Доступно слов: ${total}` : `Available words: ${total}`}</span>{customCount > 0 && <span className="ml-2 text-xs text-muted-foreground">({lang === "ru" ? `встроенных: ${pool.length}, своих: ${customCount}` : `built-in: ${pool.length}, custom: ${customCount}`})</span>}</div>
          })()}
          <div>
            <button type="button" onClick={() => setShowCustomWords((v) => !v)} className="flex w-full items-center justify-between text-sm font-semibold"><span>{t("customWords")}</span><span className="text-xs text-muted-foreground">{showCustomWords ? t("collapse") : t("expand")}</span></button>
            {showCustomWords && <div className="mt-2"><Textarea value={customWordsText} onChange={(e) => setCustomWordsText(e.target.value)} placeholder={t("customWordsPlaceholder")} className="min-h-[120px] resize-y font-mono text-sm" maxLength={4000} /><p className="mt-1.5 text-xs text-muted-foreground">{t("customWordsHint")}</p></div>}
            {!showCustomWords && customWordsText.trim().length > 0 && <p className="mt-1 text-xs text-muted-foreground">{t("addedWords")} {customWordsText.split("\n").filter((s) => s.trim()).length} · {t("customWordsExpandHint")}</p>}
          </div>
          <div className="flex gap-2">
            <Button size="lg" variant="secondary" className="flex-1 font-bold" onClick={() => onStart(visibleTeams, 10, 60, [], [], customWordsText.split("\n").map((s) => s.trim()).filter(Boolean))}><Zap className="mr-2 h-5 w-5" />{lang === "ru" ? "Быстрый старт" : "Quick start"}</Button>
            <Button size="lg" className="flex-1 text-base font-bold" onClick={() => onStart(visibleTeams, target, round, enabledCategories, enabledDifficulties, customWordsText.split("\n").map((s) => s.trim()).filter(Boolean))}><Play className="mr-2 h-5 w-5" />{t("startGame")}</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

/* ────────────────────────────── Home ────────────────────────────── */

export default function Home() {
  const reducer = useMemo(() => makeReducer(), [])
  const [state, dispatch] = useReducer(reducer, initialState)
  const [showRules, setShowRules] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showAchievements, setShowAchievements] = useState(false)
  const [showMultiplayer, setShowMultiplayer] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showGameBoard, setShowGameBoard] = useState(false)
  const [floatingScore, setFloatingScore] = useState<{ points: number; key: number; emoji: string } | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // ── Авто-реконнект к мультиплееру при обновлении страницы ──
  useEffect(() => {
    if (!hydrated) return
    try {
      const saved = sessionStorage.getItem("nastolka-mp-session")
      if (!saved) return
      const session = JSON.parse(saved) as { roomCode: string; role: "host" | "guest"; syncMode: "host" | "sync" }
      if (!session.roomCode) return
      console.log("[mp] Auto-reconnecting to room", session.roomCode)
      // Восстанавливаем номер команды
      const savedTeam = sessionStorage.getItem("nastolka-mp-team")
      if (savedTeam !== null) _setMpPlayerTeam(parseInt(savedTeam, 10))
      setMpStatus("connecting")
      // Пытаемся переподключиться к комнате
      import("@/lib/multiplayer").then(({ joinRoom, createRoom }) => {
        if (session.role === "guest") {
          joinRoom(session.roomCode, session.syncMode, getDeviceInfo()).then((client) => {
            handleMpConnect(client, "guest", session.roomCode, session.syncMode)
          }).catch(() => {
            // Комната могла удалиться — очищаем сессию
            sessionStorage.removeItem("nastolka-mp-session")
            setMpStatus("disconnected")
          })
        } else {
          // Хост пересоздаёт комнату (старая могла удалиться)
          createRoom(session.syncMode, { open: false, hostName: "???", device: getDeviceInfo() }).then((client) => {
            handleMpConnect(client, "host", client.code, session.syncMode)
          }).catch(() => {
            sessionStorage.removeItem("nastolka-mp-session")
            setMpStatus("disconnected")
          })
        }
      })
    } catch {}
  }, [hydrated])
  const { lang, toggle: toggleLang } = useLang()
  const handleToggleLang = () => { toggleLang(); track.langChange(lang === "ru" ? "en" : "ru") }
  const langRef = useRef(lang)
  langRef.current = lang

  // Мультиплеер
  const mpClientRef = useRef<MultiplayerClient | null>(null)
  const mpRoleRef = useRef<"host" | "guest" | null>(null)
  const mpSyncModeRef = useRef<"host" | "sync" | null>(null)
  const [mpStatus, setMpStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected")
  const [mpMembers, setMpMembers] = useState(1)
  const [mpError, setMpError] = useState<string | null>(null)
  const [mpRoom, setMpRoom] = useState<string | null>(null)
  const [mpPlayerTeam, setMpPlayerTeam] = useState<number>(-2) // -2 = не назначен // -1 = нет команды (spectator)
  const mpPlayerTeamRef = useRef(-2) // -2 = не назначен, -1 = spectator, 0+ = команда
  const _setMpPlayerTeam = (v: number) => { mpPlayerTeamRef.current = v; setMpPlayerTeam(v) }
  const mpClientIdRef = useRef<string>("")
  /** Серверная версия состояния — для conflict resolution */
  const mpStateVersionRef = useRef<number>(0)
  /** RTT (round-trip time) в ms — для индикатора качества связи */
  const [mpRtt, setMpRtt] = useState<number>(0)
  /** Список подключённых устройств с инфо (для отображения в диалоге) */
  const [mpDevices, setMpDevices] = useState<DeviceInfoOut[]>([])
  /** Реконнект: активная попытка (0 = нет, N = номер попытки) */
  const [mpReconnectAttempt, setMpReconnectAttempt] = useState<number>(0)
  const [opponentOffline, setOpponentOffline] = useState(false)
  const [disconnectCountdown, setDisconnectCountdown] = useState(0)
  const disconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isApplyingRemoteRef = useRef(false)

  // WordPicker
  const pickerRef = useRef<WordPicker>(new WordPicker())
  useEffect(() => { pickerRef.current = new WordPicker(state.customWords, state.enabledCategories, state.enabledDifficulties) }, [state.customWords, state.enabledCategories, state.enabledDifficulties])

  // Hydration
  useEffect(() => {
    try {
      const saved = storage.get(STATE_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<State>
        const parsedPhase = parsed.phase as string | undefined
        if (parsedPhase === "ready" || parsedPhase === "round_end" || parsedPhase === "game_over") {
          parsed.multiplier = parsed.multiplier ?? 1
          if (parsed.teams) parsed.teams = parsed.teams.map((tm) => ({ ...tm, chips: tm.chips ?? initialChips(), streak: tm.streak ?? 0 }))
          dispatch({ type: "HYDRATE", state: { ...initialState, ...parsed } as State })
        } else if (parsedPhase === "playing" || parsedPhase === "rolling" || parsedPhase === "method" || parsedPhase === "task") {
          parsed.phase = "ready"
          parsed.currentMethod = null
          parsed.currentWord = null
          parsed.wordRevealed = false
          parsed.secondsLeft = parsed.roundSeconds ?? 60
          parsed.lastRoundResult = null
          parsed.lastRoundPoints = 0
          parsed.multiplier = parsed.multiplier ?? 1
          if (parsed.teams) parsed.teams = parsed.teams.map((tm) => ({ ...tm, chips: tm.chips ?? initialChips(), streak: tm.streak ?? 0 }))
          dispatch({ type: "HYDRATE", state: { ...initialState, ...parsed } as State })
        }
      } else {
        const settings = storage.get(SETTINGS_STORAGE_KEY)
        if (settings) {
          const s = JSON.parse(settings) as Partial<State>
          const restoredTeams = (s.teams && s.teams.length >= 2 ? s.teams : initialState.teams).map((tm) => ({ ...tm, chips: tm.chips ?? initialChips(), score: 0, streak: 0 }))
          dispatch({ type: "HYDRATE", state: { ...initialState, teams: restoredTeams, targetScore: s.targetScore ?? 10, roundSeconds: s.roundSeconds ?? 60, enabledCategories: s.enabledCategories ?? [], enabledDifficulties: s.enabledDifficulties ?? [], customWords: s.customWords ?? [] } })
        }
      }
    } catch {}
    setHydrated(true)
  }, [])

  // Save state
  useEffect(() => {
    if (!hydrated) return
    try {
      if (state.phase === "setup") {
        storage.remove(STATE_STORAGE_KEY)
        storage.set(SETTINGS_STORAGE_KEY, JSON.stringify({ teams: state.teams, targetScore: state.targetScore, roundSeconds: state.roundSeconds, enabledCategories: state.enabledCategories, enabledDifficulties: state.enabledDifficulties, customWords: state.customWords }))
        return
      }
      // ── Debounce: не пишем на каждый тик таймера (500мс задержка) ──
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        const snapshot: State = { ...state }
        if (["rolling", "method", "task", "playing"].includes(snapshot.phase)) { snapshot.phase = "ready"; snapshot.currentMethod = null; snapshot.currentWord = null; snapshot.wordRevealed = false; snapshot.secondsLeft = snapshot.roundSeconds; snapshot.lastRoundResult = null; snapshot.lastRoundPoints = 0 }
        storage.set(STATE_STORAGE_KEY, JSON.stringify(snapshot))
        storage.set(SETTINGS_STORAGE_KEY, JSON.stringify({ teams: state.teams, targetScore: state.targetScore, roundSeconds: state.roundSeconds, enabledCategories: state.enabledCategories, enabledDifficulties: state.enabledDifficulties, customWords: state.customWords }))
      }, 500)
    } catch {}
  }, [state, hydrated])

  // Roll
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleRoll = useCallback(() => {
    track.diceRoll()
    unlockAudio(); playDiceRoll(1400); hapticRoll(); dispatch({ type: "ROLL" })
    if (rollTimer.current) clearTimeout(rollTimer.current)
    rollTimer.current = setTimeout(() => { const method = rollDie(); const word = pickerRef.current.next(); dispatch({ type: "ROLL_RESULT", method, word }) }, 1500)
  }, [])
  useEffect(() => { return () => { if (rollTimer.current) clearTimeout(rollTimer.current) } }, [])

  // Multiplayer guest lock — moved before useEffect that uses it
  // ── Блокировка: в мультиплеере игрок может действовать только в свой раунд ──
  // mpPlayerTeam = -1 → spectator (только смотрит)
  // mpPlayerTeam = N → может действовать только когда state.activeTeam === N
  const isMpActive = mpStatus === "connected"
  const isMyTurn = !isMpActive || mpPlayerTeamRef.current === -1 || (mpPlayerTeamRef.current >= 0 && state.activeTeam === mpPlayerTeamRef.current)
  const isMpGuestLocked = isMpActive && !isMyTurn

  // Hotkeys
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return
      if (showRules || showHistory || showAchievements || showMultiplayer) return
      if (isMpGuestLocked) return
      switch (e.key.toLowerCase()) {
        case " ": e.preventDefault(); if (state.phase === "ready") handleRoll(); else if (state.phase === "playing" && !state.paused) dispatch({ type: "SCORE" }); else if (state.phase === "round_end") dispatch({ type: "NEXT_TURN" }); break
        case "s": if (state.phase === "playing" && !state.paused) dispatch({ type: "SKIP" }); break
        case "p": if (state.phase === "playing") dispatch({ type: state.paused ? "RESUME" : "PAUSE" }); break
        case "r": if (state.phase === "playing" && !state.paused && state.currentWord) { playSwap(); dispatch({ type: "SWAP_WORD", word: pickerRef.current.swap(state.currentWord.word) }) } break
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [state.phase, state.paused, showRules, showHistory, showAchievements, showMultiplayer, isMpGuestLocked])

  // Timer
  const lastTickRef = useRef<number>(-1)
  useEffect(() => { if (state.phase !== "playing") { lastTickRef.current = -1; return } const id = setInterval(() => dispatch({ type: "TICK" }), 1000); return () => clearInterval(id) }, [state.phase])
  useEffect(() => { if (state.phase !== "playing") return; if (state.secondsLeft <= 10 && state.secondsLeft > 0 && state.secondsLeft !== lastTickRef.current) { lastTickRef.current = state.secondsLeft; playTick(state.secondsLeft <= 5); hapticTick() } }, [state.secondsLeft, state.phase])

  // Countdown 3-2-1-Go
  useEffect(() => {
    if (state.phase !== "countdown") return
    playTick(true)
    hapticTick()
    const id = setTimeout(() => dispatch({ type: "COUNTDOWN_TICK" }), 1000)
    return () => clearTimeout(id)
  }, [state.phase, state.countdownSeconds])

  // Swipe gestures for mobile (playing phase)
  useEffect(() => {
    if (state.phase !== "playing" || state.paused) return
    let startX = 0, startY = 0
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 1) { startX = e.touches[0].clientX; startY = e.touches[0].clientY }
    }
    const onEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 0) return
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      // Горизонтальный свайп (больше 100px, меньше 50px вертикали)
      if (Math.abs(dx) > 100 && Math.abs(dy) < 50) {
        if (dx > 0) { dispatch({ type: "SCORE" }); hapticScore() }
        else { dispatch({ type: "SKIP" }); hapticSkip() }
      }
    }
    window.addEventListener("touchstart", onStart, { passive: true })
    window.addEventListener("touchend", onEnd, { passive: true })
    return () => {
      window.removeEventListener("touchstart", onStart)
      window.removeEventListener("touchend", onEnd)
    }
  }, [state.phase, state.paused])

  // Round end sound
  const lastResultRef = useRef<string>("")
  useEffect(() => {
    if (state.phase === "round_end" && state.lastRoundResult && state.lastRoundResult !== lastResultRef.current) {
      lastResultRef.current = state.lastRoundResult
      if (state.lastRoundResult === "scored") {
        // Трекинг события
        if (state.currentWord) track.scored(state.lastRoundPoints, displayWord(state, langRef.current), getMethodForRound(state)?.id || "")
        // Звуковой приоритет: milestone > big score > correct
        const team = state.teams[state.activeTeam]
        const newStreak = team?.streak ?? 0
        if (isStreakMilestone(newStreak)) playMilestone()
        else if (state.lastRoundPoints >= 10) playBigScore()
        else playCorrect()
        hapticScore()
        // Полноэкранное «+N»
        setFloatingScore({
          points: state.lastRoundPoints,
          key: Date.now(),
          emoji: team?.emoji ?? "🎯",
        })
        // Маленькое конфетти для каждого угаданного слова
        const colors = ["#10b981", "#34d399", "#fbbf24", "#f97316", "#a78bfa"]
        confetti({
          particleCount: 30 + Math.min(state.lastRoundPoints * 4, 60),
          spread: 70,
          startVelocity: 35,
          decay: 0.92,
          scalar: 0.9,
          origin: { x: 0.5, y: 0.6 },
          colors,
          ticks: 120,
        })
      } else {
        playSkip()
        if (state.currentWord) track.skipped(displayWord(state, langRef.current), getMethodForRound(state)?.id || "")
        hapticSkip()
      }
    }
    if (state.phase !== "round_end") lastResultRef.current = ""
    if (state.phase === "round_end" && state.lastRoundResult === "skipped" && state.secondsLeft === 0) playTimeUp()
  }, [state.phase, state.lastRoundResult, state.secondsLeft, state.lastRoundPoints, state.activeTeam, state.teams])

  // Авто-скрытие floatingScore через 2 сек
  useEffect(() => {
    if (!floatingScore) return
    const tid = setTimeout(() => setFloatingScore(null), 2000)
    return () => clearTimeout(tid)
  }, [floatingScore])

  // Звук «ваш ход» при переходе в фазу ready (новый ход команды)
  const prevPhaseRef = useRef(state.phase)
  const prevActiveTeamRef = useRef(state.activeTeam)
  useEffect(() => {
    // Только при переходе к "ready" из другой фазы (round_end → новый ход)
    if (state.phase === "ready" && prevPhaseRef.current !== "ready") {
      playTeamActive()
    }
    // ── В мультиплеере: звук при переходе хода к другому игроку ──
    if (isMpActive && state.activeTeam !== prevActiveTeamRef.current && state.phase === "ready") {
      if (state.activeTeam === mpPlayerTeamRef.current) {
        playTeamActive() // Твой ход — звон!
      }
    }
    prevPhaseRef.current = state.phase
    prevActiveTeamRef.current = state.activeTeam
  }, [state.phase, state.activeTeam, isMpActive, mpPlayerTeam])

  // Win + confetti + achievements — финальный «марш» (4 фазы конфетти)
  useEffect(() => {
    if (state.phase !== "game_over" || state.winner === null) return
    playWin(); hapticWin()
    // Трекинг
    const winnerName = state.teams[state.winner]?.name || ""
    const scores = state.teams.map((t) => t.score)
    track.gameOver(winnerName, scores)
    const scoredRounds = state.history.filter((h) => h.result === "scored")
    recordGameComplete({ rounds: state.history.length, scored: scoredRounds.length, skipped: state.history.length - scoredRounds.length, swaps: state.swapsUsed, winnerScore: state.teams[state.winner]?.score ?? 0, roundPoints: state.history.map((h) => h.points), bestStreak: Math.max(...state.teams.map((tm) => tm.streak), 0) })
    const colors = [["#f43f5e", "#fb7185"], ["#10b981", "#34d399"], ["#f59e0b", "#fbbf24"], ["#8b5cf6", "#a78bfa"], ["#0ea5e9", "#38bdf8"]][state.winner]
    // Фаза 1: постоянный поток с боков (3 сек)
    const end1 = Date.now() + 3000
    ;(function frame1() {
      confetti({ particleCount: 8, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors, scalar: 1.1 })
      confetti({ particleCount: 8, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors, scalar: 1.1 })
      if (Date.now() < end1) requestAnimationFrame(frame1)
    })()
    // Фаза 2: большой салют из центра через 0.5 сек
    setTimeout(() => {
      confetti({ particleCount: 120, spread: 360, startVelocity: 45, decay: 0.92, scalar: 1.4, origin: { x: 0.5, y: 0.5 }, colors })
    }, 500)
    // Фаза 3: золотой дождь сверху через 1.5 сек
    setTimeout(() => {
      confetti({ particleCount: 80, spread: 100, startVelocity: 30, decay: 0.95, scalar: 1.2, gravity: 0.8, ticks: 300, origin: { x: 0.5, y: 0 }, colors: ["#fbbf24", "#f59e0b", "#fcd34d", "#fde68a"] })
    }, 1500)
    // Фаза 4: финальные «звёзды» с 4 углов через 2.5 сек
    setTimeout(() => {
      const corners = [{ x: 0.1, y: 0.2, angle: 60 }, { x: 0.9, y: 0.2, angle: 120 }, { x: 0.1, y: 0.8, angle: 30 }, { x: 0.9, y: 0.8, angle: 150 }]
      corners.forEach((c, i) => {
        setTimeout(() => {
          confetti({ particleCount: 40, angle: c.angle, spread: 60, startVelocity: 50, decay: 0.9, scalar: 1.3, origin: { x: c.x, y: c.y }, colors })
        }, i * 100)
      })
    }, 2500)
  }, [state.phase, state.winner])

  // Поделиться результатом — через Web Share API или clipboard
  const handleShareResult = useCallback(async () => {
    if (state.winner === null) return
    const winner = state.teams[state.winner]
    const isRu = lang === "ru"
    const lines = [
      isRu ? "🏆 Настолка — итоги игры" : "🏆 Nastolka — game results",
      "",
      isRu ? `🥇 Победитель: ${winner.emoji} ${winner.name} — ${winner.score} очков` : `🥇 Winner: ${winner.emoji} ${winner.name} — ${winner.score} points`,
      ...state.teams
        .filter((_, i) => i !== state.winner)
        .map((tm, idx) => `   ${["🥈", "🥉", "🏅"][idx] ?? "   "} ${tm.emoji} ${tm.name} — ${tm.score}`),
      "",
      isRu ? `🎲 Раундов сыграно: ${state.history.length}` : `🎲 Rounds played: ${state.history.length}`,
      isRu ? `🎯 Угадано: ${state.history.filter((h) => h.result === "scored").length}` : `🎯 Scored: ${state.history.filter((h) => h.result === "scored").length}`,
      isRu ? `🔄 Замен: ${state.swapsUsed}` : `🔄 Swaps: ${state.swapsUsed}`,
    ]
    const text = lines.join("\n")
    // Web Share API (мобильные)
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: isRu ? "Настолка — итоги" : "Nastolka — results",
          text,
        })
        return
      } catch {
        // пользователь отменил — продолжаем к clipboard
      }
    }
    // Fallback: clipboard
    try {
      await navigator.clipboard.writeText(text)
      // показать toast через простое уведомление
      window.alert(isRu ? "Результат скопирован в буфер обмена!" : "Result copied to clipboard!")
    } catch {
      // последний fallback — открыть alert
      window.alert(text)
    }
  }, [state, lang])

  // Multiplayer
  const handleMpConnect = useCallback((client: MultiplayerClient, role: "host" | "guest", _code: string, syncMode: "host" | "sync") => {
    mpClientRef.current = client; mpRoleRef.current = role; mpSyncModeRef.current = syncMode
    setMpStatus("connected"); setMpError(null); setMpRoom(_code || getActiveRoomCode())
    track.mpConnect(role, _code || "")

    // ── Получаем clientId от socket.io (единый для хоста и гостя) ──
    // Используем socket.id, который сервер передаёт через meta
    // Пока используем time-based ID — сервер не передаёт socket.id напрямую
    const clientId = _code ? `host-${_code}` : `guest-${Date.now()}`
    mpClientIdRef.current = clientId

    // ── Присвоение команды игроку ──
    if (role === "host") {
      _setMpPlayerTeam(0) // Хост = команда 0
      try { sessionStorage.setItem("nastolka-mp-team", "0") } catch {}
      // Команду 0 хосту назначает сервер (через team-assigned)
    }

    // ── Сохраняем сессию в sessionStorage (для авто-реконнекта при обновлении) ──
    try {
      sessionStorage.setItem("nastolka-mp-session", JSON.stringify({
        roomCode: _code || getActiveRoomCode(),
        role,
        syncMode,
      }))
    } catch {}

    // ── Heartbeat: каждые 25 сек сообщаем серверу, что клиент активен ──
    const heartbeatInterval = setInterval(() => {
      try { client.sendHeartbeat() } catch {}
    }, 25000)
    // При закрытии вкладки/переходе — отправляем последний heartbeat
    const onBeforeUnload = () => {
      try { client.sendHeartbeat() } catch {}
    }
    if (typeof window !== "undefined") window.addEventListener("beforeunload", onBeforeUnload)

    // ── Отлов обрыва связи ──
    client.on("disconnect", () => {
      clearInterval(heartbeatInterval)
      clearInterval(rttInterval)
      if (typeof window !== "undefined") window.removeEventListener("beforeunload", onBeforeUnload)
      // Не отписываемся от событий — socket.io будет пытаться переподключиться
      // (если reconnection=true). UI показывает "Переподключение…"
      setMpStatus("connecting") // индикатор «попытка переподключения»
      setMpError(null)
      setMpRtt(0)
    })
    // ── Реконнект: попытки ──
    client.on("reconnect_attempt", (payload) => {
      setMpReconnectAttempt(payload.attempt)
    })
    client.on("reconnect", () => {
      setMpReconnectAttempt(0)
      setMpStatus("connected")
      setMpError(null)
      // Перезапросить snapshot + список устройств + чат-историю
      try { client.requestSnapshot() } catch {}
      try { client.requestChatHistory() } catch {}
      // Перезапускаем heartbeat
      try { client.sendHeartbeat() } catch {}
    })
    client.on("reconnect_failed", () => {
      // Все попытки исчерпаны — финальный разрыв
      clearInterval(heartbeatInterval)
      clearInterval(rttInterval)
      client.off("state-update")
      client.off("state-stale")
      client.off("state-snapshot")
      client.off("state-requested")
      client.off("peer-joined")
      client.off("peer-left")
      client.off("peer-away")
      client.off("team-assigned")
      client.off("room-devices")
      client.off("rtt-pong")
      client.off("disconnect")
      client.off("connect_error")
      client.off("reconnect_attempt")
      client.off("reconnect")
      client.off("reconnect_failed")
      setMpStatus("error")
      setMpReconnectAttempt(0)
      setMpError(t(langRef.current, "mpConnectionLost"))
      setMpRoom(null)
    })
    client.on("connect_error", () => {
      setMpStatus("error")
      setMpError(t(langRef.current, "mpConnectionLost"))
      setMpRoom(null)
    })
    // ── Сервер назначил команду этому устройству ──
    client.on("team-assigned", (payload) => {
      if (payload?.teamIdx !== undefined && payload.teamIdx >= 0) {
        _setMpPlayerTeam(payload.teamIdx)
        try { sessionStorage.setItem("nastolka-mp-team", String(payload.teamIdx)) } catch {}
      }
    })

    client.on("state-update", (payload) => {
      if (!payload?.state) return
      isApplyingRemoteRef.current = true
      dispatch({ type: "HYDRATE", state: payload.state })
      // Обновляем локальную версию состояния с сервера
      if (payload?.version !== undefined) mpStateVersionRef.current = payload.version
      // ── Гость: ищем свою команду в playerTeams ──
      // ── Команда определяется сервером через team-assigned (см. выше) ──
      // Если сервер ещё не назначил — проверяем sessionStorage
      if (mpRoleRef.current === "guest" && mpPlayerTeamRef.current === -1) {
        const savedTeam = sessionStorage.getItem("nastolka-mp-team")
        if (savedTeam !== null) {
          _setMpPlayerTeam(parseInt(savedTeam, 10))
        }
      }
      setTimeout(() => { isApplyingRemoteRef.current = false }, 100)
    })
    // ── Сервер отклонил наше обновление (устаревшая версия) — применяем актуальное состояние ──
    client.on("state-stale", (payload) => {
      if (payload?.version !== undefined) mpStateVersionRef.current = payload.version
      if (payload?.state) {
        isApplyingRemoteRef.current = true
        dispatch({ type: "HYDRATE", state: payload.state as State })
        setTimeout(() => { isApplyingRemoteRef.current = false }, 100)
      }
    })
    // ── Snapshot при входе в комнату — инициализируем состояние ──
    client.on("state-snapshot", (payload) => {
      if (payload?.version !== undefined) mpStateVersionRef.current = payload.version
      if (payload?.state) {
        isApplyingRemoteRef.current = true
        dispatch({ type: "HYDRATE", state: payload.state as State })
        setTimeout(() => { isApplyingRemoteRef.current = false }, 100)
      }
    })
    // ── RTT-pong: измеряем качество связи ──
    const rttInflightRef: Map<number, number> = new Map()
    client.on("rtt-pong", (payload) => {
      if (payload?.clientTime !== undefined) {
        const rtt = Date.now() - payload.clientTime
        if (rtt >= 0 && rtt < 10000) setMpRtt(rtt) // защита от clock skew
      }
    })
    // Регулярный RTT-измерение каждые 5 сек
    const rttInterval = setInterval(() => {
      try { client.sendRttPing() } catch {}
    }, 5000)
    // Первый замер сразу
    setTimeout(() => { try { client.sendRttPing() } catch {} }, 500)

    client.on("state-requested", (payload) => { if (mpClientRef.current) mpClientRef.current.sendStateTo(payload.from, stateRef.current) })
    // ── Обновление списка устройств (для UI мультиплеер-диалога) ──
    client.on("room-devices", (payload) => {
      if (payload?.devices) setMpDevices(payload.devices as DeviceInfoOut[])
      if (payload?.members) setMpMembers(payload.members)
      if (payload?.stateVersion !== undefined) mpStateVersionRef.current = payload.stateVersion
    })
    // ── Peer-away: соперник отошёл ──
    client.on("peer-away", (payload) => {
      // Можно использовать для UI-индикатора в будущем
      // console.log("[mp] peer-away", payload)
    })
    client.on("peer-joined", (payload) => {
      setMpMembers(payload.members)
      // ── Соперник вернулся — отменяем таймер автовыигрыша ──
      if (opponentOffline) {
        setOpponentOffline(false)
        setDisconnectCountdown(0)
        if (disconnectTimerRef.current) { clearInterval(disconnectTimerRef.current); disconnectTimerRef.current = null }
      }
      // Команду назначает сервер (через team-assigned) — клиенту не нужно
    })
    client.on("peer-left", (payload) => {
      setMpMembers(payload.members)
      // ── Соперник отключился — запускаем отсчёт 30 сек ──
      if (payload.members < 2 && mpRoleRef.current === "host" && stateRef.current.phase !== "setup" && stateRef.current.phase !== "game_over") {
        setOpponentOffline(true)
        setDisconnectCountdown(30)
        if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current)
        disconnectTimerRef.current = setInterval(() => {
          setDisconnectCountdown((prev) => {
            if (prev <= 1) {
              // Время вышло — автовыигрыш
              if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current)
              disconnectTimerRef.current = null
              // Определяем победителя — текущий игрок (хост)
              const winner = mpPlayerTeamRef.current >= 0 ? mpPlayerTeamRef.current : 0
              dispatch({ type: "GAME_OVER_WINNER" as any, winner } as any)
              setOpponentOffline(false)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    })

    if (role === "guest") setTimeout(() => client.requestState(), 500)
  }, [])

  // ── Отключение сокета при unmount ──
  useEffect(() => {
    return () => {
      if (mpClientRef.current) {
        try { mpClientRef.current.disconnect() } catch {}
        mpClientRef.current = null
      }
      try { sessionStorage.removeItem("nastolka-mp-session") } catch {}
      if (saveTimerRef.current) { clearTimeout(saveTimerRef.current) }
      if (mpSendTimerRef.current) { clearTimeout(mpSendTimerRef.current) }
      if (disconnectTimerRef.current) { clearInterval(disconnectTimerRef.current) }
    }
  }, [])

  // ── Отправка state в мультиплеер (с дебаунсом 300мс) ──
  const mpSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state // всегда актуальное состояние

  useEffect(() => {
    if (!hydrated || mpStatus !== "connected" || isApplyingRemoteRef.current || !mpClientRef.current || state.phase === "setup") return
    // В режиме "host" только хост отправляет state
    if (mpSyncModeRef.current === "host" && mpRoleRef.current !== "host") return

    // Дебаунс 300мс — не отправляем на каждый тик таймера
    if (mpSendTimerRef.current) clearTimeout(mpSendTimerRef.current)
    mpSendTimerRef.current = setTimeout(() => {
      if (mpClientRef.current && !isApplyingRemoteRef.current) {
        mpClientRef.current.sendState(stateRef.current, mpStateVersionRef.current)
      }
    }, 100)
  }, [state, mpStatus, hydrated])

  const activeTeam = state.teams[state.activeTeam]
  const hasHistory = state.history.length > 0
  const i18nValue = useMemo(() => ({ lang, t: (key: StringKey) => t(lang, key) }), [lang])

  return (
    <I18nContext.Provider value={i18nValue}>
      <div className="nastolka-bg relative min-h-screen w-full">
        <FloatingBubbles />
        <div className="relative z-10 flex min-h-screen flex-col items-center">
          <HeaderBar onShowRules={() => setShowRules(true)} onShowHistory={() => setShowHistory(true)} onShowAchievements={() => setShowAchievements(true)} onShowMultiplayer={() => setShowMultiplayer(true)} onShowSettings={() => setShowSettings(true)} hasHistory={hasHistory} multiplayerStatus={mpStatus} lang={lang} onToggleLang={handleToggleLang} activeTeam={state.activeTeam} isMpActive={isMpActive} mpPlayerTeam={mpPlayerTeam} teams={state.teams} phase={state.phase} opponentOffline={opponentOffline} />
          {/* ── Баннер: соперник отключился (30 сек до автовыигрыша) ── */}
          <AnimatePresence>
            {isMpActive && opponentOffline && state.phase !== "setup" && state.phase !== "game_over" && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-3 w-full max-w-2xl px-4">
                <div className="flex items-center gap-3 rounded-2xl bg-rose-500/15 p-4 ring-1 ring-rose-500/30">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-500 text-white shadow"><AlertCircle className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-rose-600 dark:text-rose-400">{t(lang, "mpOpponentDisconnected")}</div>
                    <div className="text-xs text-muted-foreground">{t(lang, "mpAutoWinIn")} {disconnectCountdown}s</div>
                  </div>
                  <div className="text-2xl font-black tabular-nums text-rose-500">{disconnectCountdown}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {state.phase !== "setup" && state.stealTeam >= 0 && state.stealTeam < state.teams.length && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-3 w-full max-w-2xl px-4">
                <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-fuchsia-500/15 via-violet-500/15 to-pink-500/15 p-3 ring-1 ring-fuchsia-500/30 backdrop-blur-sm">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow"><Dices className="h-5 w-5" strokeWidth={2.4} /></div>
                  <div className="min-w-0 flex-1"><div className="text-sm font-bold">🎲 {t(lang, "stealNoticeTitle")} {state.teams[state.stealTeam].emoji} {state.teams[state.stealTeam].name}</div><div className="text-xs text-muted-foreground">{t(lang, "stealNoticeHint")}</div></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <main className="flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-8">
            <AnimatePresence mode="wait">
              {state.phase === "setup" && (
                <motion.div key="setup" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="w-full">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-center">
                    <div className="w-full lg:max-w-3xl lg:flex-1">
                      <SetupScreen initialTeams={state.teams} initialTarget={state.targetScore} initialRound={state.roundSeconds} initialCategories={state.enabledCategories} initialDifficulties={state.enabledDifficulties} initialCustomWords={state.customWords.join("\n")} onStart={(teams, target, r, cats, diffs, customWords) => { const freshPicker = new WordPicker(customWords, cats, diffs); pickerRef.current = freshPicker; const stealTeam = Math.floor(Math.random() * teams.length); dispatch({ type: "START_GAME", teams, targetScore: target, roundSeconds: r, enabledCategories: cats, enabledDifficulties: diffs, customWords, word: freshPicker.next(), stealTeam }) }} />
                    </div>
                    <aside className="w-full lg:max-w-sm lg:sticky lg:top-4">
                      <ChatPanel client={mpClientRef.current} phase={state.phase} selfDeviceId={getDeviceId()} lang={lang} />
                    </aside>
                  </div>
                </motion.div>
              )}
              {state.phase === "ready" && (
                <motion.div key="ready" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="flex w-full flex-col items-center gap-6">
                  <div className="w-full"><div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">{state.teams.map((tm, i) => <TeamScoreCard key={i} team={tm} active={state.activeTeam === i} target={state.targetScore} />)}</div></div>
                  {/* Прогресс-бар игры */}
                  {(() => {
                    const maxScore = Math.max(...state.teams.map((tm) => tm.score), 0)
                    const pct = Math.min(100, (maxScore / state.targetScore) * 100)
                    const leaderTeam = state.teams.findIndex((tm) => tm.score === maxScore)
                    const leader = state.teams[leaderTeam]
                    if (maxScore === 0) return null
                    return (
                      <div className="w-full max-w-xl">
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{leader.emoji} {leader.name}: {maxScore} / {state.targetScore}</span>
                          <span>{Math.round(pct)}%</span>
                        </div>
                        <div className="progress-bar h-2 w-full overflow-hidden rounded-full bg-muted">
                          <motion.div className={`h-full rounded-full bg-gradient-to-r ${leader.color}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                        </div>
                      </div>
                    )
                  })()}
                  <Card className="w-full max-w-xl p-6 text-center shadow-xl sm:p-8">
                    <div className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">{t(lang, "teamTurnShort")} · {lang === "ru" ? "Раунд" : "Round"} {state.history.length + 1}</div>
                    <div className="mb-1 flex items-center justify-center gap-3"><span className="text-5xl">{activeTeam.emoji}</span><div className="text-3xl font-black sm:text-4xl">{activeTeam.name}</div></div>
                    <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{t(lang, "onePlayerHint")}</p>
                    {isMpGuestLocked && isMpActive && <div className="mt-4 rounded-xl bg-amber-500/15 p-3 text-sm text-amber-700 dark:text-amber-400">{t(lang, "mpWaitingTurn")}</div>}
                    <Button size="lg" className="mt-6 w-full max-w-xs text-base font-bold" onClick={handleRoll} disabled={isMpGuestLocked}><Dices className="mr-2 h-5 w-5" />{t(lang, "rollDice")}</Button>
                  </Card>
                </motion.div>
              )}
              {(state.phase === "rolling" || state.phase === "method" || state.phase === "task") && (
                <motion.div key="dice-stage" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="flex w-full flex-col items-center gap-6">
                  <div className="w-full"><div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">{state.teams.map((tm, i) => <TeamScoreCard key={i} team={tm} active={state.activeTeam === i} target={state.targetScore} />)}</div></div>
                  <Card className="w-full max-w-2xl p-6 shadow-xl sm:p-8">
                    <div className="mb-4 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="text-2xl">{activeTeam.emoji}</span><span className="font-semibold">{activeTeam.name}</span></div><Button variant="ghost" size="sm" onClick={() => dispatch({ type: "BACK_TO_SETUP" })}>{t(lang, "exit")}</Button></div>
                    <div className="dice-container flex flex-col items-center gap-5 py-2">
                      <Dice method={state.phase === "rolling" ? null : getMethodForRound(state) ?? state.currentMethod} rolling={state.phase === "rolling"} size={220} lang={lang} />
                      {state.phase !== "rolling" && state.currentMethod && <div className="text-center"><div className="mb-2"><span className={`inline-flex items-center gap-2 rounded-full ${state.currentMethod.color} px-5 py-2 text-base font-bold uppercase tracking-wider shadow`}>{(() => { const labelKey: Record<string, StringKey> = { words: "methodWords", songs: "methodSongs", drawings: "methodDrawings", gestures: "methodGestures", yesno: "methodYesNo", choice: "methodChoice", reroll: "methodReroll" }; return t(lang, labelKey[state.currentMethod.id]) })()}</span></div><p className="mx-auto max-w-md text-sm text-muted-foreground">{(() => { const hintKey: Record<string, StringKey> = { words: "methodWordsHint", songs: "methodSongsHint", drawings: "methodDrawingsHint", gestures: "methodGesturesHint", yesno: "methodYesNoHint", choice: "methodChoiceHint", reroll: "methodRerollHint" }; return t(lang, hintKey[state.currentMethod.id]) })()}</p></div>}
                      {state.phase === "method" && state.currentMethod?.id === "choice" && state.chosenMethodForChoice === null && <div className="w-full max-w-md"><div className="mb-2 text-center text-sm font-semibold text-muted-foreground">{t(lang, "chooseMethod")}</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.values(METHODS).map((m) => <button key={m.id} type="button" onClick={() => dispatch({ type: "CHOOSE_METHOD", methodId: m.id as Exclude<MethodId, "choice" | "reroll">, word: pickerRef.current.next() })} className={`flex flex-col items-center gap-1 rounded-2xl ${m.color} p-3 font-bold uppercase tracking-wide shadow transition hover:scale-105`}>{(() => { const Icon = m.id === "words" ? Type : m.id === "songs" ? Music : m.id === "drawings" ? Brush : m.id === "yesno" ? HelpCircle : Hand; return <Icon className="h-6 w-6" /> })()}<span className="text-xs">{(() => { const labelKey: Record<string, StringKey> = { words: "methodWords", songs: "methodSongs", drawings: "methodDrawings", gestures: "methodGestures", yesno: "methodYesNo", choice: "methodChoice", reroll: "methodReroll" }; return t(lang, labelKey[m.id]) })()}</span></button>)}</div></div>}
                      {state.phase === "method" && state.currentMethod?.id === "reroll" && <Button size="lg" onClick={handleRoll} className="font-bold"><Dices className="mr-2 h-5 w-5" />{t(lang, "reroll")}</Button>}
                      {state.phase === "method" && state.currentMethod && state.currentMethod.id !== "reroll" && (state.currentMethod.id !== "choice" || state.chosenMethodForChoice !== null) && <Button size="lg" onClick={() => dispatch({ type: "SHOW_WORD" })} disabled={isMpGuestLocked} className="font-bold"><ArrowRight className="mr-2 h-5 w-5" />{t(lang, "toWord")}</Button>}
                      {state.phase === "task" && state.currentWord && <div className="w-full max-w-md rounded-2xl border border-dashed border-foreground/20 bg-muted/40 p-5 text-center"><div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t(lang, "wordHiddenLabel")}</div><div className="flex items-center justify-center gap-2"><EyeOff className="h-5 w-5 text-muted-foreground" /><span className="text-2xl font-black tracking-widest text-foreground/70">••••••••</span></div><div className="mt-2 text-xs text-muted-foreground">{t(lang, "wordHiddenHint")}</div><Button size="lg" variant="default" className="mt-4 w-full font-bold" onClick={() => dispatch({ type: "START_COUNTDOWN" })} disabled={isMpGuestLocked}><Eye className="mr-2 h-5 w-5" />{t(lang, "showWord")}</Button></div>}
                    </div>
                  </Card>
                </motion.div>
              )}
              {state.phase === "countdown" && state.currentWord && (
                <motion.div key="countdown" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex w-full flex-col items-center gap-6">
                  <Card className="w-full max-w-2xl p-8 text-center shadow-xl sm:p-12">
                    <div className="mb-4 flex items-center justify-center gap-2"><span className="text-2xl">{activeTeam.emoji}</span><span className="font-semibold">{activeTeam.name}</span></div>
                    <div className="mb-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">{t(lang, "chooseMethod") === "Выберите способ объяснения:" ? "Приготовьтесь!" : "Get ready!"}</div>
                    <motion.div key={state.countdownSeconds} initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 10 }} className="text-9xl font-black">
                      {state.countdownSeconds > 0 ? state.countdownSeconds : (t(lang, "chooseMethod") === "Выберите способ объяснения:" ? "Старт!" : "Go!")}
                    </motion.div>
                    <div className="mt-6 text-sm text-muted-foreground">{t(lang, "wordHiddenHint")}</div>
                  </Card>
                </motion.div>
              )}
              {state.phase === "playing" && state.currentWord && (
                <motion.div key="playing" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="flex w-full flex-col items-center gap-6">
                  <div className="w-full"><div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">{state.teams.map((tm, i) => <TeamScoreCard key={i} team={tm} active={state.activeTeam === i} target={state.targetScore} />)}</div></div>
                  <Card className="w-full max-w-2xl p-6 shadow-xl sm:p-8">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="text-2xl">{activeTeam.emoji}</span><span className="font-semibold">{activeTeam.name}</span></div><span className={`inline-flex items-center gap-2 rounded-full ${getMethodForRound(state)!.color} px-3 py-1 font-bold uppercase tracking-wider shadow text-xs`}>{(() => { const labelKey: Record<string, StringKey> = { words: "methodWords", songs: "methodSongs", drawings: "methodDrawings", gestures: "methodGestures", yesno: "methodYesNo", choice: "methodChoice", reroll: "methodReroll" }; return t(lang, labelKey[getMethodForRound(state)!.id]) })()}</span></div>
                    <div className="relative"><Timer secondsLeft={state.secondsLeft} total={state.roundSeconds} paused={state.paused} /><button type="button" onClick={() => dispatch({ type: state.paused ? "RESUME" : "PAUSE" })} className="absolute right-0 top-0 inline-flex h-9 items-center gap-1.5 rounded-full bg-muted px-3 text-xs font-semibold text-muted-foreground transition hover:bg-foreground hover:text-background">{state.paused ? <><Play className="h-3.5 w-3.5" />{t(lang, "resume")}</> : <><Pause className="h-3.5 w-3.5" />{t(lang, "pause")}</>}</button></div>
                    <AnimatePresence>{state.paused && <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="mt-3 rounded-2xl border-2 border-dashed border-foreground/30 bg-muted/60 p-4 text-center"><div className="flex items-center justify-center gap-2 text-sm font-semibold"><Pause className="h-4 w-4" />{t(lang, "pausedHint")}</div><p className="mt-1 text-xs text-muted-foreground">{t(lang, "pausedHint2")}</p></motion.div>}</AnimatePresence>
                    {!state.paused && <div className="mt-6 word-card rounded-3xl bg-gradient-to-br from-amber-50 to-rose-50 p-6 text-center dark:from-amber-950/30 dark:to-rose-950/30"><div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground"><span>{categoryLabel(lang, state.currentWord.category)}</span>{state.currentWord.difficulty && <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${DIFFICULTY_COLORS[state.currentWord.difficulty]}`}>{difficultyLabel(lang, state.currentWord.difficulty)}</span>}</div><motion.div key={state.currentWord.word} initial={{ scale: 0.7, opacity: 0, rotate: -3 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 240, damping: 18 }} className="my-2 text-4xl font-black tracking-tight word-title sm:text-5xl">{displayWord(state, lang)}</motion.div><div className="text-sm text-muted-foreground">{t(lang, "explainByMethodPrefix")} "{(() => { const m = getMethodForRound(state)!; const labelKey: Record<string, StringKey> = { words: "methodWords", songs: "methodSongs", drawings: "methodDrawings", gestures: "methodGestures", yesno: "methodYesNo", choice: "methodChoice", reroll: "methodReroll" }; return t(lang, labelKey[m.id]) })()}"</div><div className="mt-3 flex items-center justify-center gap-2"><PointsBadge state={state} />{state.multiplier > 1 && <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 text-xs font-black uppercase tracking-wider text-white shadow">×{state.multiplier} {t(lang, "multiplierActivated")}</span>}</div></div>}
                    {!state.paused && getMethodForRound(state)?.id === "drawings" && <div className="mt-4"><DrawingCanvas resetKey={state.currentWord?.word} /></div>}
                    {!state.paused && getMethodForRound(state)?.id === "songs" && <SongRecorder resetKey={state.currentWord?.word} lang={lang} />}
                    {!state.paused && <ChipsBar state={state} dispatch={dispatch} isMpGuestLocked={isMpGuestLocked} />}
                    <div className="mt-6 grid grid-cols-2 gap-3"><Button size="lg" className="bg-emerald-500 text-white font-bold hover:bg-emerald-600" onClick={() => dispatch({ type: "SCORE" })} disabled={state.paused || isMpGuestLocked}><Check className="mr-2 h-5 w-5" />{t(lang, "guessed")}</Button><Button size="lg" variant="outline" className="font-bold border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => dispatch({ type: "SKIP" })} disabled={state.paused || isMpGuestLocked}><X className="mr-2 h-5 w-5" />{t(lang, "skip")}</Button></div>
                    <button type="button" onClick={() => { playSwap(); if (state.currentWord) dispatch({ type: "SWAP_WORD", word: pickerRef.current.swap(state.currentWord.word) }) }} className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" />{t(lang, "swapWordLabel")}{state.swapsUsed > 0 ? ` · ${t(lang, "swapsCount")}: ${state.swapsUsed}` : ""}</button>
                    {/* Кнопка подсказки — показывает количество букв в слове */}
                    {!state.paused && state.currentWord && <HintButton word={displayWord(state, lang)} lang={lang} />}
                    <p className="mt-2 text-center text-xs text-muted-foreground">{t(lang, "scoredResultHint")}</p>
                    {/* Подсказка о свайпах */}
                    <p className="mt-1 text-center text-[10px] text-muted-foreground/60 sm:hidden">{lang === "ru" ? "Свайп вправо — угадали, влево — пропустить" : "Swipe right — guessed, left — skip"}</p>
                  </Card>
                </motion.div>
              )}
              {state.phase === "round_end" && (
                <motion.div key="round_end" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="w-full max-w-xl">
                  <Card className="p-8 text-center shadow-xl">
                    <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14 }} className={`mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full ${state.lastRoundResult === "scored" ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>{state.lastRoundResult === "scored" ? <Check className="h-10 w-10" strokeWidth={3} /> : <X className="h-10 w-10" strokeWidth={3} />}</motion.div>
                    {state.lastRoundResult === "scored" ? <motion.div initial={{ scale: 0, opacity: 0, rotate: -10 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }} className="my-2"><span className={`text-7xl font-black tabular-nums ${state.lastRoundPoints >= 10 ? "bg-gradient-to-br from-amber-400 via-orange-500 to-pink-600 bg-clip-text text-transparent" : "text-emerald-500"}`}>+{state.lastRoundPoints}</span><span className="ml-2 text-2xl font-bold text-muted-foreground">{pluralPoints(state.lastRoundPoints, lang)}</span></motion.div> : null}
                    <h2 className="text-2xl font-black">{state.lastRoundResult === "scored" ? t(lang, "teamGuessed") : t(lang, "roundFailed")}</h2>
                    {state.lastRoundResult === "scored" && state.lastRoundMultiplier > 1 && <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-2 inline-block rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 text-sm font-bold text-white shadow">×{state.lastRoundMultiplier}! {state.lastRoundBasePoints} → {state.lastRoundPoints} {pluralPoints(state.lastRoundPoints, lang)}</motion.p>}
                    {/* Бейдж бонуса серии 🔥 */}
                    {state.lastRoundResult === "scored" && (state.lastRoundStreakBonus ?? 0) > 0 && (() => {
                      const activeTeam = state.teams[state.activeTeam]
                      const streak = activeTeam?.streak ?? 0
                      return (
                        <motion.p
                          initial={{ opacity: 0, scale: 0.8, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ delay: 0.4, type: "spring", stiffness: 220, damping: 14 }}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-3 py-1 text-sm font-bold text-white shadow"
                        >
                          <span className="text-base">🔥</span>
                          {t(lang, "streakBonusLabel")} ×{streak}
                          <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-black uppercase">
                            +{state.lastRoundStreakBonus}
                          </span>
                        </motion.p>
                      )
                    })()}
                    {state.currentWord && <p className="mt-2 text-sm text-muted-foreground">{t(lang, "wordWasLabel")} <span className="font-bold text-foreground">{displayWord(state, lang)}</span></p>}
                    <div className="mt-6 rounded-2xl bg-muted/50 p-4"><div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t(lang, "scoreLabel")}</div><div className="mt-1 flex items-center justify-center gap-6">{state.teams.map((tm, i) => <div key={i} className="flex items-center gap-2"><span className="text-2xl">{tm.emoji}</span><div className="text-left"><div className="text-sm font-semibold">{tm.name}</div><div className="text-2xl font-black">{tm.score}</div></div></div>)}</div></div>
                    <Button size="lg" className="mt-6 w-full font-bold" onClick={() => dispatch({ type: "NEXT_TURN" })}><ChevronRight className="mr-2 h-5 w-5" />{t(lang, "passTurn")}</Button>
                    {state.history.length > 0 && <button type="button" onClick={() => dispatch({ type: "UNDO_ROUND" })} className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"><RotateCcw className="h-3.5 w-3.5" />{lang === "ru" ? "Отменить раунд" : "Undo round"}</button>}
                    {state.teams[state.activeTeam]?.chips.stealTurn > 0 && <Button size="lg" className="mt-2 w-full bg-gradient-to-r from-fuchsia-600 to-violet-700 font-bold text-white hover:from-fuchsia-700 hover:to-violet-800" onClick={() => dispatch({ type: "STEAL_TURN" })} disabled={isMpGuestLocked}><Dices className="mr-2 h-5 w-5" />{t(lang, "stealActivate")}</Button>}
                    {/* ── Карточка «Повтор раунда» — применить во время игры соперников ── */}
                    {state.phase === "round_end" && state.lastRoundResult === "scored" && (() => {
                      const lastEntry = state.history[state.history.length - 1]
                      if (!lastEntry || lastEntry.result !== "scored") return null
                      // В мультиплеере — кнопка доступна только если это НЕ твой раунд (т.е. соперник отгадал)
                      const canReplay = !isMpActive || mpPlayerTeamRef.current !== lastEntry.team
                      if (!canReplay) return null
                      return (
                        <Button size="lg" variant="outline" className="mt-2 w-full border-amber-400/40 text-amber-600 font-bold hover:bg-amber-500/10 dark:text-amber-400" onClick={() => dispatch({ type: "REPLAY_ROUND" })} disabled={isMpGuestLocked}>
                          <RotateCcw className="mr-2 h-5 w-5" />{t(lang, "replayRound")} (−10s)
                        </Button>
                      )
                    })()}
                  </Card>
                </motion.div>
              )}
              {state.phase === "game_over" && state.winner !== null && (
                <motion.div key="game_over" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full max-w-xl">
                  <Card className="relative overflow-hidden p-8 text-center shadow-2xl">
                    {/* Фоновое свечение */}
                    <motion.div
                      className="pointer-events-none absolute inset-0 -z-10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      style={{
                        background: "radial-gradient(circle at 50% 30%, rgba(251,191,36,0.4) 0%, transparent 60%)",
                      }}
                    />
                    {/* Брендовый логотип */}
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                      className="mb-4 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      <div className="nastolka-logo-tile" style={{ width: '1.4em', height: '1.4em' }} aria-hidden>
                        <div className="nastolka-logo-tile-dots">
                          <span></span><span></span><span></span>
                          <span></span><span></span><span></span>
                          <span></span><span></span><span></span>
                        </div>
                      </div>
                      <span>{t(lang, "appName")}</span>
                    </motion.div>
                    {/* Кубок с bouncing-анимацией */}
                    <motion.div
                      initial={{ rotate: -20, scale: 0, y: -50 }}
                      animate={{ rotate: 0, scale: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 220, damping: 10, delay: 0.1 }}
                      className="relative mx-auto mb-4 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg"
                    >
                      <motion.div
                        animate={{ rotate: [0, -8, 8, -8, 0], y: [0, -3, 0] }}
                        transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                      >
                        <Trophy className="h-12 w-12" strokeWidth={2.4} />
                      </motion.div>
                      {/* Блики вокруг кубка */}
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                        style={{ boxShadow: "0 0 30px 8px rgba(251,191,36,0.6)" }}
                      />
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                      <div className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{t(lang, "winner")}</div>
                      <h2 className="mt-1 text-4xl font-black">{state.teams[state.winner].emoji} {state.teams[state.winner].name}</h2>
                      <p className="mt-2 text-muted-foreground">{t(lang, "finalScore")} {state.teams.map((tm) => tm.score).join(" : ")}</p>
                    </motion.div>

                    {/* Пьедестал почёта с медалями */}
                    {state.teams.length >= 2 && (
                      <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="mt-6 flex items-end justify-center gap-2"
                      >
                        {(() => {
                          // Сортируем команды по очкам (по убыванию)
                          const sorted = state.teams
                            .map((tm, idx) => ({ ...tm, originalIdx: idx }))
                            .sort((a, b) => b.score - a.score)
                          const medals = ["🥇", "🥈", "🥉", "🏅"]
                          const heights = [120, 90, 70, 60]
                          const gradients = [
                            "from-amber-400/30 to-orange-500/30 ring-amber-400/40",
                            "from-slate-300/30 to-slate-400/30 ring-slate-300/40",
                            "from-orange-700/30 to-amber-800/30 ring-orange-600/40",
                            "from-violet-400/30 to-purple-500/30 ring-violet-400/40",
                          ]
                          return sorted.map((tm, rank) => (
                            <motion.div
                              key={tm.originalIdx}
                              initial={{ opacity: 0, y: 50 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.6 + rank * 0.15, type: "spring", stiffness: 220, damping: 14 }}
                              className="flex flex-1 flex-col items-center"
                            >
                              <div className="mb-1 text-3xl">{medals[rank]}</div>
                              <div className="text-2xl">{tm.emoji}</div>
                              <div className="truncate text-xs font-semibold opacity-80">{tm.name}</div>
                              <div className="text-lg font-black">{tm.score}</div>
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: heights[rank] }}
                                transition={{ delay: 0.7 + rank * 0.15, type: "spring", stiffness: 200, damping: 18 }}
                                className={`mt-2 flex w-full items-start justify-center rounded-t-xl bg-gradient-to-b p-2 ring-1 ${gradients[Math.min(rank, 3)]}`}
                              >
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                  #{rank + 1}
                                </span>
                              </motion.div>
                            </motion.div>
                          ))
                        })()}
                      </motion.div>
                    )}

                    {state.history.length > 0 && <p className="mt-4 text-xs text-muted-foreground">{t(lang, "roundsPlayed")} {state.history.length} · {t(lang, "swapsCount")}: {state.swapsUsed}</p>}
                    {/* Лучшая серия игры */}
                    {(() => {
                      const maxStreak = Math.max(...state.teams.map((tm) => tm.streak), 0)
                      if (maxStreak < 2) return null
                      const streakTeamIdx = state.teams.findIndex((tm) => tm.streak === maxStreak)
                      const streakTeam = state.teams[streakTeamIdx]
                      return (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 1.1 }}
                          className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500/20 to-red-500/20 px-4 py-1.5 text-sm font-bold ring-1 ring-orange-500/30"
                        >
                          <span className="text-base">🔥</span>
                          <span className="text-orange-600 dark:text-orange-400">
                            {streakTeam.emoji} {t(lang, "bestStreakLabel")} ×{maxStreak}
                          </span>
                        </motion.div>
                      )
                    })()}
                    {/* MVP раунда — лучшее слово игры */}
                    {(() => {
                      const scored = state.history.filter((h) => h.result === "scored" && h.points > 0)
                      if (scored.length === 0) return null
                      const mvp = scored.reduce((best, cur) => cur.points > best.points ? cur : best, scored[0])
                      const mvpTeam = state.teams[mvp.team]
                      const methodLabel = (() => { const lk: Record<string, StringKey> = { words: "methodWords", songs: "methodSongs", drawings: "methodDrawings", gestures: "methodGestures", yesno: "methodYesNo", choice: "methodChoice", reroll: "methodReroll" }; return t(lang, lk[mvp.method]) })()
                      return (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="mt-4 rounded-2xl bg-gradient-to-br from-amber-400/20 via-orange-400/20 to-rose-400/20 p-4 ring-1 ring-amber-400/30">
                          <div className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">{lang === "ru" ? "Лучший раунд" : "Best round"}</div>
                          <div className="mt-2 flex items-center justify-center gap-3">
                            <span className="text-2xl">{mvpTeam.emoji}</span>
                            <div className="text-center">
                              <div className="text-xl font-black">{mvp.word}</div>
                              <div className="text-xs text-muted-foreground">{methodLabel} · +{mvp.points} {pluralPoints(mvp.points, lang)}{mvp.multiplier > 1 && ` (×${mvp.multiplier})`}</div>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })()}
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <Button size="lg" className="flex-1 font-bold" onClick={() => { const newSteal = Math.floor(Math.random() * state.teams.length); dispatch({ type: "RESTART", word: pickerRef.current.next(), stealTeam: newSteal }) }}><RotateCcw className="mr-2 h-5 w-5" />{t(lang, "playAgain")}</Button>
                      <Button size="lg" variant="outline" className="flex-1" onClick={() => setShowHistory(true)}><ListChecks className="mr-2 h-5 w-5" />{t(lang, "gameStats")}</Button>
                    </div>
                    <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={handleShareResult}><Share2 className="mr-2 h-4 w-4" />{lang === "ru" ? "Поделиться результатом" : "Share result"}</Button>
                    <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => setShowAchievements(true)}><Award className="mr-2 h-4 w-4" />{t(lang, "achievements")}</Button>
                    <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => dispatch({ type: "BACK_TO_SETUP" })}><PartyPopper className="mr-2 h-4 w-4" />{t(lang, "newGame")}</Button>
                  </Card>
                  <div className="mt-4 w-full">
                    <ChatPanel client={mpClientRef.current} phase={state.phase} selfDeviceId={getDeviceId()} lang={lang} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          <footer className="w-full max-w-6xl px-4 pb-6 pt-2 text-center text-xs text-muted-foreground">{t(lang, "footerText")}</footer>
        </div>

        <RulesDialog open={showRules} onOpenChange={setShowRules} lang={lang} />
        <HistoryDialog open={showHistory} onOpenChange={setShowHistory} state={state} lang={lang} />
        <AchievementsDialog open={showAchievements} onOpenChange={setShowAchievements} />
        <MultiplayerDialog open={showMultiplayer} onOpenChange={setShowMultiplayer} onConnect={handleMpConnect} status={mpStatus} members={mpMembers} errorMessage={mpError} lang={lang} roomCode={mpRoom} rttMs={mpRtt} devices={mpDevices} reconnectAttempt={mpReconnectAttempt} onDisconnect={() => { if (mpClientRef.current) { try { mpClientRef.current.disconnect() } catch {} ; mpClientRef.current = null } setMpStatus("disconnected"); setMpRoom(null); setMpMembers(1); _setMpPlayerTeam(-1); try { sessionStorage.removeItem("nastolka-mp-session") } catch {} }} />
        <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
        {state.phase !== "setup" && state.phase !== "game_over" && (
          <GameBoard
            teams={state.teams}
            targetScore={state.targetScore}
            open={showGameBoard}
            onToggle={() => { setShowGameBoard((v) => { if (!v) track.boardOpen(); else track.boardClose(); return !v }) }}
            lang={lang}
            activeTeamIdx={state.activeTeam}
          />
        )}

        {/* Полноэкранные плавающие «+N» при scored */}
        <AnimatePresence>
          {floatingScore && (
            <motion.div
              key={floatingScore.key}
              initial={{ opacity: 0, scale: 0.3, y: 0 }}
              animate={{ opacity: 1, scale: 1, y: -80 }}
              exit={{ opacity: 0, scale: 0.6, y: -150 }}
              transition={{ duration: 1.8, ease: "easeOut" }}
              className="pointer-events-none fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2"
            >
              <div className="flex items-center gap-3 rounded-3xl bg-gradient-to-br from-emerald-500/90 to-teal-600/90 px-6 py-4 text-white shadow-2xl ring-2 ring-white/40 backdrop-blur-md">
                <span className="text-5xl">{floatingScore.emoji}</span>
                <div className="flex flex-col">
                  <span className="text-6xl font-black leading-none drop-shadow-lg">+{floatingScore.points}</span>
                  <span className="text-xs font-bold uppercase tracking-widest opacity-90">{lang === "ru" ? "очков" : "points"}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </I18nContext.Provider>
  )
}

/* ────────────────────────────── HintButton ────────────────────────────── */

function HintButton({ word, lang }: { word: string; lang: Lang }) {
  const [shown, setShown] = useState(false)
  // Считаем только буквы (без пробелов и дефисов)
  const letterCount = word.replace(/[^а-яёa-z]/gi, "").length
  const wordLength = word.length
  const ru = lang === "ru"
  // Текст подсказки (для эффекта печатной машинки)
  const hintText = ru
    ? `В слове ${letterCount} ${letterCount === 1 ? "буква" : letterCount < 5 ? "буквы" : "букв"} (${wordLength} ${wordLength === 1 ? "символ" : "символов"})`
    : `${letterCount} letters (${wordLength} chars total)`
  // Анимация печатной машинки: побуквенное появление
  const [typedText, setTypedText] = useState("")
  useEffect(() => {
    if (!shown) {
      setTypedText("")
      return
    }
    let i = 0
    setTypedText("")
    const tid = setInterval(() => {
      i++
      setTypedText(hintText.slice(0, i))
      if (i >= hintText.length) clearInterval(tid)
    }, 30)
    return () => clearInterval(tid)
  }, [shown, hintText])

  return (
    <div className="mt-2 flex items-center justify-center gap-2">
      <AnimatePresence mode="wait">
        {!shown ? (
          <motion.button
            key="hint-btn"
            type="button"
            onClick={() => { setShown(true); track.hintUsed() }}
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 transition hover:bg-amber-500/20 dark:text-amber-400"
          >
            <motion.span
              animate={{ rotate: [0, 15, -15, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Lightbulb className="h-3.5 w-3.5" />
            </motion.span>
            {ru ? "Подсказка" : "Hint"}
          </motion.button>
        ) : (
          <motion.div
            key="hint-shown"
            initial={{ opacity: 0, scale: 0.8, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 280, damping: 18 }}
            className="rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400"
          >
            <Lightbulb className="mr-1.5 inline h-3.5 w-3.5" />
            <span>{typedText}</span>
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="ml-0.5 inline-block w-1"
            >
              |
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ────────────────────────────── RulesDialog ────────────────────────────── */

function RulesDialog({ open, onOpenChange, lang }: { open: boolean; onOpenChange: (v: boolean) => void; lang: Lang }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto nice-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl"><Dices className="h-6 w-6" />{t(lang, "rulesTitle")}</DialogTitle>
          <DialogDescription>{t(lang, "rulesDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed">
          <p>{t(lang, "rulesIntro")}</p>
          <ul className="space-y-2">
            <li className="flex items-start gap-3 rounded-xl bg-emerald-500/10 p-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-500 text-white"><Type className="h-4 w-4" /></span><div><b>{t(lang, "methodWords")}</b> — {t(lang, "methodWordsHint")}</div></li>
            <li className="flex items-start gap-3 rounded-xl bg-rose-500/10 p-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-rose-500 text-white"><Music className="h-4 w-4" /></span><div><b>{t(lang, "methodSongs")}</b> — {t(lang, "methodSongsHint")}</div></li>
            <li className="flex items-start gap-3 rounded-xl bg-amber-500/10 p-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-500 text-white"><Brush className="h-4 w-4" /></span><div><b>{t(lang, "methodDrawings")}</b> — {t(lang, "methodDrawingsHint")}</div></li>
            <li className="flex items-start gap-3 rounded-xl bg-violet-500/10 p-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500 text-white"><Hand className="h-4 w-4" /></span><div><b>{t(lang, "methodGestures")}</b> — {t(lang, "methodGesturesHint")}</div></li>
            <li className="flex items-start gap-3 rounded-xl bg-teal-500/10 p-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-teal-500 text-white"><HelpCircle className="h-4 w-4" /></span><div><b>{t(lang, "methodYesNo")}</b> — {t(lang, "methodYesNoHint")}</div></li>
            <li className="flex items-start gap-3 rounded-xl bg-sky-500/10 p-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-500 text-white"><Sparkles className="h-4 w-4" /></span><div><b>{t(lang, "methodChoice")}</b> — {t(lang, "methodChoiceHint")}</div></li>
            <li className="flex items-start gap-3 rounded-xl bg-indigo-500/10 p-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-500 text-white"><Dices className="h-4 w-4" /></span><div><b>{t(lang, "methodReroll")}</b> — {t(lang, "methodRerollHint")}</div></li>
          </ul>
          <div className="rounded-xl bg-muted/60 p-4"><div className="font-semibold">{t(lang, "rulesRound")}</div><ol className="ml-4 mt-2 list-decimal space-y-1"><li>{t(lang, "rulesRound1")}</li><li>{t(lang, "rulesRound2")}</li><li>{t(lang, "rulesRound3")}</li><li>{t(lang, "rulesRound4")}</li><li>{t(lang, "rulesRound5")}</li><li>{t(lang, "rulesRound6")}</li></ol></div>
          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-4 dark:from-amber-950/30 dark:to-orange-950/30"><div className="font-semibold">{t(lang, "rulesPointsTitle")}</div><p className="mt-1 text-sm text-muted-foreground">{t(lang, "rulesExample")}{t(lang, "rulesExampleDetail")}</p><div className="mt-2 grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t(lang, "rulesByMethod")}</div><ul className="mt-1 space-y-0.5"><li>{t(lang, "rulesWords1")}</li><li>{t(lang, "rulesSongs2")}</li><li>{t(lang, "rulesDrawings2")}</li><li>{t(lang, "rulesGestures3")}</li><li>{t(lang, "rulesYesno2")}</li></ul></div><div><div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t(lang, "rulesByDifficulty")}</div><ul className="mt-1 space-y-0.5"><li>{t(lang, "rulesEasy1")}</li><li>{t(lang, "rulesMedium2")}</li><li>{t(lang, "rulesHard3")}</li></ul></div></div></div>
          <div className="rounded-xl bg-gradient-to-br from-orange-50 to-red-50 p-4 dark:from-orange-950/30 dark:to-red-950/30"><div className="font-semibold">{t(lang, "rulesStreakTitle")}</div><p className="mt-1 text-sm text-muted-foreground">{t(lang, "rulesStreakHint")}</p><ul className="mt-2 space-y-1 text-sm"><li>🔥 {t(lang, "rulesStreak3")}</li><li>🔥 {t(lang, "rulesStreak5")}</li><li>🔥 {t(lang, "rulesStreak10")}</li></ul><p className="mt-2 text-xs text-muted-foreground">{t(lang, "rulesStreakTip")}</p></div>
          <div className="rounded-xl bg-gradient-to-br from-fuchsia-50 to-pink-50 p-4 dark:from-fuchsia-950/30 dark:to-pink-950/30"><div className="font-semibold">{t(lang, "rulesChipsTitle")}</div><p className="mt-1 text-sm text-muted-foreground">{t(lang, "rulesChipsHint")}</p><ul className="mt-2 space-y-1.5 text-sm"><li><span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-br from-fuchsia-500 to-pink-600 px-2 py-0.5 text-xs font-bold text-white">×2</span><b> ×2 (2 {t(lang, "rulesPieces")})</b> — {t(lang, "rulesChipX2")}</li><li><span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-br from-sky-500 to-cyan-600 px-2 py-0.5 text-xs font-bold text-white">+10 {t(lang, "secShort")}</span><b> +10 {t(lang, "rulesSeconds")} (1 {t(lang, "rulesPieces")})</b> — {t(lang, "rulesChipPlus10")}</li><li><span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-br from-indigo-500 to-blue-600 px-2 py-0.5 text-xs font-bold text-white">+5 {t(lang, "secShort")}</span><b> +5 {t(lang, "rulesSeconds")} (1 {t(lang, "rulesPieces")})</b> — {t(lang, "rulesChipPlus5")}</li><li><span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-br from-fuchsia-600 to-violet-700 px-2 py-0.5 text-xs font-bold text-white">🎲</span><b> {t(lang, "rulesStealTurn")}</b> — {t(lang, "rulesStealHint")}</li></ul><p className="mt-2 text-xs text-muted-foreground">{t(lang, "rulesTip")}</p></div>
          <p className="text-muted-foreground">{t(lang, "rulesWin")}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ────────────────────────────── HistoryDialog ────────────────────────────── */

function HistoryDialog({ open, onOpenChange, state, lang }: { open: boolean; onOpenChange: (v: boolean) => void; state: State; lang: Lang }) {
  const history = state.history
  const stats = useMemo(() => {
    const byTeam: Record<number, { scored: number; total: number }> = {}
    for (let i = 0; i < state.teams.length; i++) byTeam[i] = { scored: 0, total: 0 }
    const byMethod: Record<string, { scored: number; total: number }> = {}
    for (const e of history) {
      if (!byTeam[e.team]) byTeam[e.team] = { scored: 0, total: 0 }
      byTeam[e.team].total++; if (e.result === "scored") byTeam[e.team].scored++
      if (!byMethod[e.method]) byMethod[e.method] = { scored: 0, total: 0 }
      byMethod[e.method].total++; if (e.result === "scored") byMethod[e.method].scored++
    }
    return { byTeam, byMethod }
  }, [history, state.teams.length])

  const methodLabels: Record<MethodId, string> = { words: t(lang, "methodWords"), songs: t(lang, "methodSongs"), drawings: t(lang, "methodDrawings"), gestures: t(lang, "methodGestures"), yesno: t(lang, "methodYesNo"), choice: t(lang, "methodChoice"), reroll: t(lang, "methodReroll") }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto nice-scroll">
        <DialogHeader><DialogTitle className="flex items-center gap-2 text-2xl"><ListChecks className="h-6 w-6" />{t(lang, "historyTitle")}</DialogTitle><DialogDescription>{t(lang, "historyTotalRounds")} {history.length}. {t(lang, "historySwaps")} {state.swapsUsed}.</DialogDescription></DialogHeader>
        {history.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">{t(lang, "achEmpty")}</div> : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{state.teams.map((tm, i) => { const s = stats.byTeam[i] ?? { scored: 0, total: 0 }; const successRate = s.total > 0 ? Math.round((s.scored / s.total) * 100) : 0; return <div key={i} className={`rounded-2xl bg-gradient-to-br ${tm.color} p-4 text-white shadow`}><div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider opacity-90"><span className="text-lg">{tm.emoji}</span><span className="truncate">{tm.name}</span></div><div className="mt-1 text-3xl font-black">{tm.score}</div><div className="text-xs opacity-80">{lang === "ru" ? `Угадано ${s.scored} из ${s.total} · успех ${successRate}%` : `Guessed ${s.scored} of ${s.total} · success ${successRate}%`}</div></div> })}</div>
            <div><div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t(lang, "historySuccessByMethod")}</div><div className="space-y-1.5">{(["words", "songs", "drawings", "gestures", "yesno", "choice"] as const).map((id) => { const s = stats.byMethod[id]; if (!s || s.total === 0) return null; const pct = Math.round((s.scored / s.total) * 100); const m = METHODS[id]; return <div key={id} className="flex items-center gap-2 text-sm"><span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${m.color}`}>{(() => { const Icon = id === "words" ? Type : id === "songs" ? Music : id === "drawings" ? Brush : id === "gestures" ? Hand : id === "yesno" ? HelpCircle : Sparkles; return <Icon className="h-3 w-3" /> })()}</span><span className="w-24 shrink-0 font-semibold">{methodLabels[id]}</span><div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className={`h-full ${m.color.split(" ")[0]}`} style={{ width: `${pct}%` }} /></div><span className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{s.scored}/{s.total} · {pct}%</span></div> })}</div></div>
            <div><div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t(lang, "historyRounds")}</div><div className="max-h-72 space-y-1 overflow-y-auto nice-scroll pr-1">{[...history].reverse().map((e, idx) => { const team = state.teams[e.team]; const m = METHODS[e.method] ?? SPECIAL_METHODS[e.method as "choice" | "reroll"]; return <div key={idx} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-sm"><span className="text-base">{team.emoji}</span><span className="w-20 shrink-0 truncate font-semibold">{team.name}</span><span className={`inline-flex h-5 w-5 items-center justify-center rounded ${m.color}`}>{(() => { const Icon = e.method === "words" ? Type : e.method === "songs" ? Music : e.method === "drawings" ? Brush : e.method === "gestures" ? Hand : e.method === "yesno" ? HelpCircle : e.method === "choice" ? Sparkles : Dices; return <Icon className="h-3 w-3" /> })()}</span><span className="flex-1 truncate">{e.word}</span>{e.result === "scored" ? <Check className="h-4 w-4 shrink-0 text-emerald-500" /> : <X className="h-4 w-4 shrink-0 text-destructive" />}</div> })}</div></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
