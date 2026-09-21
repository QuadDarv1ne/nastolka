"use client"

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import confetti from "canvas-confetti"
import {
  Dices,
  Type,
  Music,
  Brush,
  Hand,
  Sparkles,
  Trophy,
  Play,
  RotateCcw,
  Eye,
  EyeOff,
  Check,
  X,
  ChevronRight,
  Clock,
  Info,
  PartyPopper,
  ArrowRight,
  RefreshCw,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  ListChecks,
  Pause,
  Users,
  Award,
  Share2,
  Languages,
  Radio,
  Settings,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  DICE_FACES,
  METHODS,
  SPECIAL_METHODS,
  CATEGORY_LABELS,
  DIFFICULTY_COLORS,
  METHOD_POINTS,
  DIFFICULTY_POINTS,
  getRoundPoints,
  rollDie,
  localizedWord,
  WordPicker,
  type Method,
  type MethodId,
  type BaseMethod,
  type WordEntry,
  type WordCategory,
  type Difficulty,
} from "@/lib/game-data"
import { Dice } from "@/components/dice"
import { DrawingCanvas } from "@/components/drawing-canvas"
import { SongRecorder } from "@/components/song-recorder"
import { AchievementsDialog } from "@/components/achievements-dialog"
import { MultiplayerDialog } from "@/components/multiplayer-dialog"
import { SettingsDialog, isCountdownEnabled } from "@/components/settings-dialog"
import { GameBoard } from "@/components/game-board"
import type { MultiplayerClient } from "@/lib/multiplayer"
import {
  isMuted,
  playCorrect,
  playDiceRoll,
  playSkip,
  playSwap,
  playTick,
  playTimeUp,
  playWin,
  playChipX2,
  playChipPlus10,
  playChipPlus5,
  playBigScore,
  playTeamActive,
  setMuted,
  setHapticsEnabled,
  unlockAudio,
  hapticRoll,
  hapticScore,
  hapticSkip,
  hapticChip,
  hapticWin,
  hapticTick,
} from "@/lib/sounds"
import { recordGameComplete } from "@/lib/achievements"
import { useTheme } from "@/hooks/use-theme"
import { useLang } from "@/hooks/use-lang"
import { I18nContext, useI18n } from "@/hooks/i18n-context"
import { t, categoryLabel, difficultyLabel, type Lang, type StringKey } from "@/lib/i18n"
import {
  type Phase,
  type Team,
  type TeamChips,
  type RoundHistoryEntry,
  type State,
  type Action,
  initialChips,
  ACTIVE_PHASES,
  RESTORABLE_PHASES,
} from "@/lib/types"

/* ────────────────────────────── Типы ────────────────────────────── */
// Типы Phase/Team/TeamChips/State/Action вынесены в src/lib/types.ts
// (без циклических импортов page.tsx ↔ multiplayer.ts).


const STORAGE_PREFIX = "nastolka"
const STATE_STORAGE_KEY = `${STORAGE_PREFIX}-state-v1`
const SETTINGS_STORAGE_KEY = `${STORAGE_PREFIX}-settings-v1`

const initialState: State = {
  phase: "setup",
  teams: [
    { name: "Команда А", color: "from-rose-500 to-pink-600", textOnColor: "text-white", emoji: "🦊", score: 0, chips: initialChips() },
    { name: "Команда Б", color: "from-emerald-500 to-teal-600", textOnColor: "text-white", emoji: "🐻", score: 0, chips: initialChips() },
  ],
  activeTeam: 0,
  targetScore: 10,
  roundSeconds: 60,
  currentMethod: null,
  chosenMethodForChoice: null,
  currentWord: null,
  wordRevealed: false,
  secondsLeft: 60,
  lastRoundResult: null,
  lastRoundPoints: 0,
  lastRoundBasePoints: 0,
  lastRoundMultiplier: 1,
  multiplier: 1,
  recentWords: [],
  winner: null,
  history: [],
  swapsUsed: 0,
  paused: false,
  enabledCategories: [],
  enabledDifficulties: [],
  customWords: [],
  stealTeam: -1,
  stealJustUsed: false,
  countdownSeconds: 0,
}

function makeReducer() {
  return function reducer(state: State, action: Action): State {
    switch (action.type) {
      case "START_GAME": {
        // Назначаем фишку Кража хода случайной команде
        const teamsWithSteal = action.teams.map((t, i) => ({
          ...t,
          chips: { ...initialChips(), stealTurn: i === action.stealTeam ? 1 : 0 },
        }))
        return {
          ...initialState,
          phase: "ready",
          teams: teamsWithSteal,
          targetScore: action.targetScore,
          roundSeconds: action.roundSeconds,
          secondsLeft: action.roundSeconds,
          enabledCategories: action.enabledCategories,
          enabledDifficulties: action.enabledDifficulties,
          customWords: action.customWords,
          currentWord: action.word,
          activeTeam: 0,
          stealTeam: action.stealTeam,
        }
      }

      case "ROLL": {
        return { ...state, phase: "rolling", paused: false, currentWord: null, currentMethod: null, multiplier: 1 }
      }

      case "ROLL_RESULT": {
        const method = action.method
        if (method.id === "reroll") {
          // даём шанс ещё раз без слова
          return { ...state, phase: "method", currentMethod: method, currentWord: null, multiplier: 1 }
        }
        return {
          ...state,
          phase: "method",
          currentMethod: method,
          currentWord: action.word,
          wordRevealed: false,
          chosenMethodForChoice: null,
          multiplier: 1,
        }
      }

      case "CHOOSE_METHOD": {
        return {
          ...state,
          chosenMethodForChoice: action.methodId,
          currentWord: action.word,
          multiplier: 1,
        }
      }

      case "SHOW_WORD": {
        return { ...state, phase: "task", wordRevealed: false, paused: false, multiplier: 1 }
      }

      case "REVEAL_WORD": {
        return { ...state, phase: "playing", wordRevealed: true, secondsLeft: state.roundSeconds, paused: false, multiplier: 1 }
      }

      /* Отсчёт 3-2-1-Старт! перед началом раунда */
      case "START_COUNTDOWN": {
        return { ...state, phase: "countdown", countdownSeconds: 3 }
      }

      case "COUNTDOWN_TICK": {
        const next = state.countdownSeconds - 1
        // 3 → 2 → 1 → «Старт!» (0) → начало игры
        if (next < 0) {
          return { ...state, phase: "playing", wordRevealed: true, secondsLeft: state.roundSeconds, paused: false, multiplier: 1, countdownSeconds: 0 }
        }
        return { ...state, countdownSeconds: next }
      }

      case "COUNTDOWN_DONE": {
        return { ...state, phase: "playing", wordRevealed: true, secondsLeft: state.roundSeconds, paused: false, multiplier: 1, countdownSeconds: 0 }
      }

      /* Отмена последнего раунда: откатываем очки, историю и фишки */
      case "UNDO_ROUND": {
        if (state.history.length === 0) return state
        const lastEntry = state.history[state.history.length - 1]
        // Восстанавливаем счёт команды
        const newTeams = state.teams.map((tm, i) =>
          i === lastEntry.team ? { ...tm, score: tm.score - lastEntry.points } : tm
        )
        // Возвращаемся к той же команде (чей раунд был отменён)
        const prevTeam = lastEntry.team
        // Убираем последнюю запись из истории
        const newHistory = state.history.slice(0, -1)
        // Возвращаем фишку stealTurn, если она была использована в этом раунде
        const stealWasUsed = state.stealJustUsed && lastEntry.team === state.activeTeam
        const updatedTeams = stealWasUsed
          ? newTeams.map((tm, i) =>
              i === prevTeam ? { ...tm, chips: { ...tm.chips, stealTurn: tm.chips.stealTurn + 1 } } : tm
            )
          : newTeams
        return {
          ...state,
          teams: updatedTeams,
          activeTeam: prevTeam,
          phase: "ready",
          history: newHistory,
          currentMethod: null,
          chosenMethodForChoice: null,
          currentWord: null,
          wordRevealed: false,
          secondsLeft: state.roundSeconds,
          lastRoundResult: null,
          lastRoundPoints: 0,
          lastRoundBasePoints: 0,
          lastRoundMultiplier: 1,
          multiplier: 1,
          paused: false,
          stealJustUsed: false,
          stealTeam: stealWasUsed ? prevTeam : state.stealTeam,
          winner: null,
          countdownSeconds: 0,
        }
      }

      case "USE_CHIP": {
        if (state.phase !== "playing") return state
        const team = state.activeTeam
        const chips = state.teams[team].chips
        if (action.chip === "x2") {
          if (chips.x2 <= 0) return state
          // Активируем множитель. Если уже был x2 — не суммируется (макс 2).
          return {
            ...state,
            multiplier: 2,
            teams: state.teams.map((t, i) =>
              i === team ? { ...t, chips: { ...t.chips, x2: t.chips.x2 - 1 } } : t
            ),
          }
        }
        if (action.chip === "plus10") {
          if (chips.plus10 <= 0) return state
          return {
            ...state,
            secondsLeft: state.secondsLeft + 10,
            teams: state.teams.map((t, i) =>
              i === team ? { ...t, chips: { ...t.chips, plus10: t.chips.plus10 - 1 } } : t
            ),
          }
        }
        if (action.chip === "plus5") {
          if (chips.plus5 <= 0) return state
          return {
            ...state,
            secondsLeft: state.secondsLeft + 5,
            teams: state.teams.map((t, i) =>
              i === team ? { ...t, chips: { ...t.chips, plus5: t.chips.plus5 - 1 } } : t
            ),
          }
        }
        return state
      }

      case "STEAL_TURN": {
        // Кражу можно использовать только в фазе round_end и только командой,
        // у которой есть фишка stealTurn, и которая только что завершила свой раунд
        // (т.е. активная команда — тот, кто только что играл).
        if (state.phase !== "round_end") return state
        const team = state.activeTeam
        if (state.teams[team]?.chips.stealTurn <= 0) return state
        // Крадём ход: остаёмся на той же активной команде и сразу переходим в ready
        return {
          ...state,
          phase: "ready",
          teams: state.teams.map((t, i) =>
            i === team ? { ...t, chips: { ...t.chips, stealTurn: t.chips.stealTurn - 1 } } : t
          ),
          stealTeam: -1, // фишка использована
          stealJustUsed: true,
          currentMethod: null,
          chosenMethodForChoice: null,
          currentWord: null,
          wordRevealed: false,
          secondsLeft: state.roundSeconds,
          lastRoundResult: null,
          lastRoundPoints: 0,
          lastRoundBasePoints: 0,
          lastRoundMultiplier: 1,
          multiplier: 1,
        }
      }

      case "PAUSE": {
        if (state.phase !== "playing") return state
        return { ...state, paused: true }
      }

      case "RESUME": {
        if (state.phase !== "playing") return state
        return { ...state, paused: false }
      }

      case "TICK": {
        if (state.phase !== "playing" || state.paused) return state
        const next = state.secondsLeft - 1
        if (next <= 0) {
          return {
            ...state,
            secondsLeft: 0,
            phase: "round_end",
            lastRoundResult: "skipped",
            lastRoundPoints: 0,
            lastRoundBasePoints: 0,
            lastRoundMultiplier: 1,
            multiplier: 1,
            history: pushHistory(state, "skipped"),
          }
        }
        return { ...state, secondsLeft: next }
      }

      case "SWAP_WORD": {
        if (state.phase !== "playing" || !state.currentWord) return state
        return {
          ...state,
          currentWord: action.word,
          swapsUsed: state.swapsUsed + 1,
          recentWords: [...state.recentWords.slice(-29), state.currentWord.word],
        }
      }

      case "SCORE": {
        const team = state.activeTeam
        const basePoints = getRoundPoints(state.currentMethod, state.chosenMethodForChoice, state.currentWord)
        const points = basePoints * state.multiplier
        const newScore = state.teams[team].score + points
        const newTeams = state.teams.map((t, i) =>
          i === team ? { ...t, score: newScore } : t
        )

        const winner = newScore >= state.targetScore ? team : null
        return {
          ...state,
          teams: newTeams,
          phase: winner === null ? "round_end" : "game_over",
          lastRoundResult: "scored",
          lastRoundPoints: points,
          lastRoundBasePoints: basePoints,
          lastRoundMultiplier: state.multiplier,
          multiplier: 1,
          recentWords: state.currentWord
            ? [...state.recentWords.slice(-29), state.currentWord.word]
            : state.recentWords,
          winner,
          history: pushHistory(state, "scored", points, state.multiplier),
        }
      }

      case "SKIP": {
        return {
          ...state,
          phase: "round_end",
          lastRoundResult: "skipped",
          lastRoundPoints: 0,
          lastRoundBasePoints: 0,
          lastRoundMultiplier: 1,
          multiplier: 1,
          recentWords: state.currentWord
            ? [...state.recentWords.slice(-29), state.currentWord.word]
            : state.recentWords,
          history: pushHistory(state, "skipped", 0, 1),
        }
      }

      case "NEXT_TURN": {
        const total = state.teams.length
        const nextTeam = (state.activeTeam + 1) % total
        return {
          ...state,
          phase: "ready",
          activeTeam: nextTeam,
          currentMethod: null,
          chosenMethodForChoice: null,
          currentWord: null,
          wordRevealed: false,
          secondsLeft: state.roundSeconds,
          lastRoundResult: null,
          lastRoundPoints: 0,
          lastRoundBasePoints: 0,
          lastRoundMultiplier: 1,
          multiplier: 1,
          paused: false,
          stealJustUsed: false,
        }
      }

      case "REROLL": {
        return {
          ...state,
          phase: "rolling",
          currentMethod: null,
          currentWord: null,
          wordRevealed: false,
          multiplier: 1,
        }
      }

      case "RESTART": {
        const teamsWithStealRestart = state.teams.map((t, i) => ({
          ...t,
          score: 0,
          chips: { ...initialChips(), stealTurn: i === action.stealTeam ? 1 : 0 },
        }))
        return {
          ...initialState,
          phase: "ready",
          teams: teamsWithStealRestart,
          targetScore: state.targetScore,
          roundSeconds: state.roundSeconds,
          secondsLeft: state.roundSeconds,
          enabledCategories: state.enabledCategories,
          enabledDifficulties: state.enabledDifficulties,
          customWords: state.customWords,
          currentWord: action.word,
          stealTeam: action.stealTeam,
        }
      }

      case "BACK_TO_SETUP": {
        return { ...initialState }
      }

      case "HYDRATE": {
        return action.state
      }

      default:
        return state
    }
  }
}

/* Хелпер: добавить запись в историю раунда */
function pushHistory(state: State, result: "scored" | "skipped", points = 0, multiplier = 1): RoundHistoryEntry[] {
  if (!state.currentWord) return state.history
  const method = getMethodForRound(state)
  if (!method) return state.history
  const entry: RoundHistoryEntry = {
    team: state.activeTeam,
    word: state.currentWord.word,
    wordEn: state.currentWord.wordEn,
    category: state.currentWord.category,
    method: method.id,
    result,
    secondsLeft: state.secondsLeft,
    roundSeconds: state.roundSeconds,
    points,
    multiplier,
  }
  return [...state.history, entry]
}

/** Правильное склонение слова очко по числу и языку */
function pluralPoints(n: number, lang: Lang): string {
  if (lang === "en") return n === 1 ? "point" : "points"
  if (n === 1) return "очко"
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 14) return "очков"
  const last = n % 10
  if (last >= 2 && last <= 4) return "очка"
  return "очков"
}

/** Слово для показа в текущем языке (EN берёт wordEn, RU — word) */
function displayWord(entry: Pick<WordEntry, "word" | "wordEn"> | null, lang: Lang): string {
  return entry ? localizedWord(entry, lang) : "—"
}

/* ────────────────────────────── Хелперы ────────────────────────────── */

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
  if (state.currentMethod.id === "choice") {
    return state.chosenMethodForChoice ? METHODS[state.chosenMethodForChoice] : state.currentMethod
  }
  return state.currentMethod
}

/* ────────────────────────────── Компоненты ────────────────────────────── */

function FloatingBubbles() {
  // Слабый декоративный фон из пузырей
  const bubbles = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      left: `${(i * 8.3 + 5) % 100}%`,
      size: 18 + ((i * 7) % 60),
      duration: 14 + ((i * 3) % 12),
      delay: -(i * 1.7),
      hue: ["#f472b6", "#34d399", "#a78bfa", "#fbbf24", "#60a5fa"][i % 5],
    }))
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {bubbles.map((b) => (
        <span
          key={b.id}
          className="bubble"
          style={{
            left: b.left,
            width: b.size,
            height: b.size,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
            background: `radial-gradient(circle at 30% 30%, ${b.hue}66, ${b.hue}22)`,
            bottom: -80,
          }}
        />
      ))}
    </div>
  )
}

function HeaderBar({
  onShowRules,
  onShowHistory,
  onShowAchievements,
  onShowMultiplayer,
  onShowSettings,
  hasHistory,
  multiplayerStatus,
  lang,
  onToggleLang,
}: {
  onShowRules: () => void
  onShowHistory: () => void
  onShowAchievements: () => void
  onShowMultiplayer: () => void
  onShowSettings: () => void
  hasHistory: boolean
  multiplayerStatus: "disconnected" | "connecting" | "connected" | "error"
  lang: Lang
  onToggleLang: () => void
}) {
  const { theme, toggle } = useTheme()
  const [muted, setMutedState] = useState(false)

  useEffect(() => {
    setMuted(isMuted())
  }, [])

  const toggleMute = () => {
    const next = !muted
    setMutedState(next)
    setMuted(next)
    if (!next) unlockAudio()
  }

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    const shareText = t(lang, "shareText")
    try {
      if (navigator.share) {
        await navigator.share({ title: t(lang, "appName"), text: shareText, url })
      } else {
        await navigator.clipboard.writeText(`${shareText} ${url}`)
        alert(t(lang, "shareCopied"))
      }
    } catch {
      // ignore
    }
  }

  return (
    <header className="safe-top safe-x w-full max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 sm:gap-x-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/* Nastolka brand logo: red tile (rhombus) with dice dots + NASTOLKA wordmark */}
          <div className="nastolka-logo-tile shrink-0" aria-hidden>
            <div className="nastolka-logo-tile-dots">
              <span></span><span></span><span></span>
              <span></span><span></span><span></span>
              <span></span><span></span><span></span>
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="nastolka-logo-text truncate text-lg font-black leading-none tracking-tight sm:text-3xl">
              NAS<span className="inline-block" style={{ width: '0.4em' }}>·</span>TOLKA
            </h1>
            <p className="hidden text-xs text-muted-foreground sm:block sm:text-sm">
              {t(lang, "appSubtitle")}
            </p>
          </div>
        </div>
        {/* Кнопки могут переноситься на вторую строку на узких экранах —
            иконки компактнее на телефонах, крупнее на планшетах/ПК */}
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1 sm:gap-1.5">
          <Button variant="ghost" size="sm" className="size-8 p-0 sm:size-10" onClick={onShowMultiplayer} aria-label="Multiplayer">
            <Radio className={`size-4 ${multiplayerStatus === "connected" ? "text-emerald-500" : ""}`} />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-1.5 sm:h-10 sm:px-2" onClick={onToggleLang} aria-label="Change language">
            <Languages className="size-4" />
            <span className="text-[10px] font-bold uppercase">{lang}</span>
          </Button>
          <Button variant="ghost" size="sm" className="size-8 p-0 sm:size-10" onClick={onShowAchievements} aria-label={t(lang, "achievements")}>
            <Award className="size-4" />
          </Button>
          {hasHistory && (
            <Button variant="ghost" size="sm" className="h-8 px-2 sm:h-10" onClick={onShowHistory} aria-label={t(lang, "historyFull")}>
              <ListChecks className="size-4" />
              <span className="hidden sm:inline">{t(lang, "history")}</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" className="size-8 p-0 sm:size-10" onClick={handleShare} aria-label={t(lang, "share")}>
            <Share2 className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className="size-8 p-0 sm:size-10" onClick={toggleMute} aria-label={muted ? t(lang, "unmute") : t(lang, "mute")}>
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="size-8 p-0 sm:size-10" onClick={onShowSettings} aria-label={t(lang, "settingsTitle")}>
            <Settings className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className="size-8 p-0 sm:size-10" onClick={toggle} aria-label={t(lang, "themeDark")}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button variant="outline" size="sm" className="h-8 px-2 sm:h-10" onClick={onShowRules}>
            <Info className="size-4" />
            <span className="hidden sm:inline">{t(lang, "rules")}</span>
          </Button>
        </div>
      </div>
    </header>
  )
}

function TeamScoreCard({
  team,
  active,
  target,
  index = 0,
}: {
  team: Team
  active: boolean
  target: number
  /** Порядковый номер для каскадной анимации появления */
  index?: number
}) {
  const { t, lang } = useI18n()
  return (
    <motion.div
      className="team-card"
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22, delay: index * 0.08 }}
    >
      <motion.div
        animate={active ? { scale: 1.04 } : { scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
        className={`team-card-inner relative overflow-hidden rounded-2xl bg-linear-to-br ${team.color} text-white shadow-xl sm:rounded-3xl ${
          active ? "pulse-active" : ""
        }`}
      >
        <div className="team-card-emoji absolute -right-4 -top-6 select-none leading-none opacity-25">
          {team.emoji}
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-90 sm:text-sm">
            {active && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                {t("playing")}
              </span>
            )}
            <span className="min-w-0 truncate">{team.name}</span>
          </div>
          <div className="mt-1 flex items-end gap-1.5 sm:mt-2 sm:gap-2">
            <div className="team-card-score font-black leading-none tabular-nums drop-shadow-md">
              {team.score}
            </div>
            <div className="pb-1 text-xs font-medium opacity-80 sm:text-sm">/ {target}</div>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/20 sm:mt-3">
            <motion.div
              className="h-full rounded-full bg-white/90"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (team.score / target) * 100)}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          {/* Индикатор фишек (скрывается на коротких landscape-экранах) */}
          <div className="team-card-chips mt-2 flex flex-wrap items-center gap-1 text-[9px] font-semibold uppercase tracking-wider opacity-90 sm:gap-1.5 sm:text-[10px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-1.5 py-0.5">×2 × {team.chips.x2}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-1.5 py-0.5">+10s × {team.chips.plus10}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-1.5 py-0.5">+5s × {team.chips.plus5}</span>
            {team.chips.stealTurn > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-linear-to-r from-fuchsia-600 to-violet-700 px-1.5 py-0.5 font-bold">
                {t("stealActivateShort")}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/** Сетка карточек команд — колонки считаются от доступной ширины */
function TeamGrid({
  teams,
  activeTeam,
  target,
}: {
  teams: Team[]
  activeTeam: number
  target: number
}) {
  return (
    <div className="team-grid mb-6 w-full">
      {teams.map((team, i) => (
        <TeamScoreCard
          key={i}
          team={team}
          active={activeTeam === i}
          target={target}
          index={i}
        />
      ))}
    </div>
  )
}

function MethodBadge({ method, large = false }: { method: Method; large?: boolean }) {
  const { t, lang } = useI18n()
  // Локализованный label метода через i18n-ключи methodWords/methodSongs/...
  const labelKey: Record<MethodId, StringKey> = {
    words: "methodWords",
    songs: "methodSongs",
    drawings: "methodDrawings",
    gestures: "methodGestures",
    choice: "methodChoice",
    reroll: "methodReroll",
  }
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full ${method.color} px-3 py-1 font-bold uppercase tracking-wider shadow ${
        large ? "text-base px-5 py-2" : "text-xs"
      }`}
    >
      {t(labelKey[method.id])}
    </span>
  )
}

/** Бейдж За ответ: X очков — показывает сумму очков метода и сложности */
function PointsBadge({ state }: { state: State }) {
  const { t, lang } = useI18n()
  const method = getMethodForRound(state)
  if (!method || !state.currentWord) return null
  let methodId: MethodId = method.id
  if (method.id === "choice" && state.chosenMethodForChoice) methodId = state.chosenMethodForChoice
  if (methodId === "reroll") return null
  const m = METHOD_POINTS[methodId as Exclude<MethodId, "choice" | "reroll">] ?? 0
  const d = DIFFICULTY_POINTS[state.currentWord.difficulty ?? "medium"] ?? 0
  const total = (m + d) * state.multiplier
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-amber-500 to-orange-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow">
      {t("forAnswerLabel")} {total} {pluralPoints(total, lang)}
      {state.multiplier > 1 && (
        <span className="opacity-90">×{state.multiplier}</span>
      )}
    </span>
  )
}

/** Кнопки фишек команды — показываются в раунде */
function ChipsBar({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const { t, lang } = useI18n()
  const chips = state.teams[state.activeTeam]?.chips
  if (!chips) return null
  const disabled = state.paused
  const x2Used = state.multiplier > 1

  const handleChip = (chip: "x2" | "plus10" | "plus5") => {
    if (chip === "x2") playChipX2()
    else if (chip === "plus10") playChipPlus10()
    else if (chip === "plus5") playChipPlus5()
    hapticChip()
    dispatch({ type: "USE_CHIP", chip })
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
      <ChipButton
        label="×2"
        sublabel={t("chipDouble")}
        count={chips.x2}
        disabled={disabled || x2Used || chips.x2 <= 0}
        active={x2Used}
        onClick={() => handleChip("x2")}
        color="bg-linear-to-br from-fuchsia-500 to-pink-600"
        lang={lang}
      />
      <ChipButton
        label={`+10 ${t("secShort")}`}
        sublabel={t("chipTime")}
        count={chips.plus10}
        disabled={disabled || chips.plus10 <= 0}
        onClick={() => handleChip("plus10")}
        color="bg-linear-to-br from-sky-500 to-cyan-600"
        lang={lang}
      />
      <ChipButton
        label={`+5 ${t("secShort")}`}
        sublabel={t("chipTime")}
        count={chips.plus5}
        disabled={disabled || chips.plus5 <= 0}
        onClick={() => handleChip("plus5")}
        color="bg-linear-to-br from-indigo-500 to-blue-600"
        lang={lang}
      />
    </div>
  )
}

function ChipButton({
  label,
  sublabel,
  count,
  disabled,
  active,
  onClick,
  color,
  lang,
}: {
  label: string
  sublabel: string
  count: number
  disabled?: boolean
  active?: boolean
  onClick: () => void
  color: string
  lang: Lang
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex min-h-11 min-w-19 flex-col items-center justify-center rounded-xl ${color} px-3 py-1.5 text-white shadow transition ${
        disabled
          ? "opacity-30 cursor-not-allowed"
          : "hover:scale-105 active:scale-95"
      } ${active ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""}`}
      aria-label={`${label} — ${t(lang, "chipLeft")} ${count}`}
    >
      <span className="text-xs font-black leading-none">{label}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider opacity-90">{sublabel}</span>
      {count > 0 && !disabled && !active && (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] font-black text-foreground shadow">
          {count}
        </span>
      )}
    </button>
  )
}

function SetupScreen({
  initialTeams,
  initialTarget,
  initialRound,
  initialCategories,
  initialDifficulties,
  initialCustomWords,
  onStart,
}: {
  initialTeams: Team[]
  initialTarget: number
  initialRound: number
  initialCategories: WordCategory[]
  initialDifficulties: Difficulty[]
  initialCustomWords: string
  onStart: (teams: Team[], target: number, roundSeconds: number, enabledCategories: WordCategory[], enabledDifficulties: Difficulty[], customWords: string[]) => void
}) {
  const { t, lang } = useI18n()
  // Количество команд: 2, 3 или 4. Изначально столько, сколько было в initialTeams.
  const [teamCount, setTeamCount] = useState<number>(
    Math.min(4, Math.max(2, initialTeams.length))
  )
  // Массив команд (4 элемента, отображаем только первые teamCount)
  const [teams, setTeams] = useState<Team[]>(
    (() => {
      const defaults: Team[] = [
        { name: t("teamA"), color: "from-rose-500 to-pink-600", textOnColor: "text-white", emoji: "🦊", score: 0, chips: initialChips() },
        { name: t("teamB"), color: "from-emerald-500 to-teal-600", textOnColor: "text-white", emoji: "🐻", score: 0, chips: initialChips() },
        { name: t("teamV"), color: "from-sky-500 to-indigo-600", textOnColor: "text-white", emoji: "🦄", score: 0, chips: initialChips() },
        { name: t("teamG"), color: "from-amber-500 to-orange-600", textOnColor: "text-white", emoji: "🐯", score: 0, chips: initialChips() },
      ]
      // Заменяем первые 4 элемента на initialTeams (если они были заданы ранее)
      const merged = [...defaults]
      for (let i = 0; i < Math.min(4, initialTeams.length); i++) {
        merged[i] = { ...defaults[i], ...initialTeams[i] }
      }
      return merged
    })()
  )
  const [target, setTarget] = useState<number>(initialTarget)
  const [round, setRound] = useState<number>(initialRound)
  const [enabledCategories, setEnabledCategories] = useState<WordCategory[]>(initialCategories)
  const [enabledDifficulties, setEnabledDifficulties] = useState<Difficulty[]>(initialDifficulties)
  const [customWordsText, setCustomWordsText] = useState<string>(initialCustomWords)
  const [showCustomWords, setShowCustomWords] = useState<boolean>(false)

  const setTeamAt = (index: number, t: Team) => {
    setTeams((prev) => prev.map((x, i) => (i === index ? t : x)))
  }

  const visibleTeams = teams.slice(0, teamCount)
  // Все цвета видимых команд, чтобы исключить дубликаты
  const usedColors = (i: number) => visibleTeams.filter((_, idx) => idx !== i).map((t) => t.color)

  const toggleCategory = (c: WordCategory) => {
    setEnabledCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    )
  }

  const toggleDifficulty = (d: Difficulty) => {
    setEnabledDifficulties((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    )
  }

  const allCategories = Object.keys(CATEGORY_LABELS) as WordCategory[]
  const allDifficulties: Difficulty[] = ["easy", "medium", "hard"]

  return (
    <div className="w-full max-w-3xl px-3 sm:px-4">
      <Card className="p-4 shadow-xl sm:p-8">
        <div className="space-y-5 sm:space-y-6">
          <div>
            <h2 className="text-xl font-bold sm:text-2xl">{t("setupTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("setupDescription")}
            </p>
          </div>

          {/* Количество команд */}
          <div>
            <Label className="mb-2 block">{t("teamCount")}</Label>
            <div className="flex flex-wrap gap-2">
              {[2, 3, 4].map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={teamCount === n ? "default" : "outline"}
                  onClick={() => setTeamCount(n)}
                  className="min-w-fit flex-1"
                >
                  {n === 2 ? t("twoTeams") : n === 3 ? t("threeTeams") : t("fourTeams")}
                </Button>
              ))}
            </div>
          </div>

          {/* Карточки команд */}
          <div className="space-y-3">
            {visibleTeams.map((team, i) => (
              <TeamSetupCard
                key={i}
                label={[t("teamA"), t("teamB"), t("teamV"), t("teamG")][i] ?? ""}
                team={team}
                setTeam={(t) => setTeamAt(i, t)}
                excludeColors={usedColors(i)}
              />
            ))}
          </div>

          {/* Цель и время */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block">{t("targetScore")}</Label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {[5, 10, 15, 20, 30].map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant={target === v ? "default" : "outline"}
                    onClick={() => setTarget(v)}
                    className="w-full"
                  >
                    {v} {t("pointsShort")}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">{t("roundTime")}</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[30, 45, 60, 90].map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant={round === v ? "default" : "outline"}
                    onClick={() => setRound(v)}
                    className="w-full"
                  >
                    {v} {t("secShort")}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Категории слов */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label>{t("categories")}</Label>
              <button
                type="button"
                onClick={() => setEnabledCategories([])}
                className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
              >
                {enabledCategories.length === 0 ? t("allCategories") : t("selectAll")}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allCategories.map((c) => {
                const active = enabledCategories.length === 0 || enabledCategories.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCategory(c)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {categoryLabel(lang, c)}
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {enabledCategories.length === 0
                ? t("allCategoriesHint")
                : `${t("categoriesSelected")} ${enabledCategories.length}`}
            </p>
          </div>

          {/* Сложность слов */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label>{t("difficulty")}</Label>
              <button
                type="button"
                onClick={() => setEnabledDifficulties([])}
                className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
              >
                {enabledDifficulties.length === 0 ? t("allCategories") : t("selectAll")}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allDifficulties.map((d) => {
                const active = enabledDifficulties.length === 0 || enabledDifficulties.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDifficulty(d)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? DIFFICULTY_COLORS[d]
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {difficultyLabel(lang, d)}
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {enabledDifficulties.length === 0
                ? t("allDifficultiesHint")
                : `${t("difficultiesSelected")} ${enabledDifficulties.length}`}
            </p>
          </div>

          {/* Кастомные слова */}
          <div>
            <button
              type="button"
              onClick={() => setShowCustomWords((v) => !v)}
              className="flex w-full items-center justify-between text-sm font-semibold"
            >
              <span>{t("customWords")}</span>
              <span className="text-xs text-muted-foreground">
                {showCustomWords ? t("collapse") : t("expand")}
              </span>
            </button>
            {showCustomWords && (
              <div className="mt-2">
                <Textarea
                  value={customWordsText}
                  onChange={(e) => setCustomWordsText(e.target.value)}
                  placeholder={t("customWordsPlaceholder")}
                  className="min-h-30 resize-y font-mono text-sm"
                  maxLength={4000}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {t("customWordsHint")}
                </p>
              </div>
            )}
            {!showCustomWords && customWordsText.trim().length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("addedWords")} {customWordsText.split("\n").filter((s) => s.trim()).length} · {t("customWordsExpandHint")}
              </p>
            )}
          </div>

          {/* Быстрая игра — дефолты без настройки */}
          <div>
            <Button
              size="lg"
              variant="outline"
              className="w-full text-base font-bold"
              onClick={() =>
                onStart(
                  teams.slice(0, 2),
                  10,
                  60,
                  [],
                  [],
                  []
                )
              }
            >
              <Zap className="mr-2 h-5 w-5 text-amber-500" />
              {t("quickGame")}
            </Button>
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              {t("quickGameHint")}
            </p>
          </div>

          <Button
            size="lg"
            className="w-full text-base font-bold"
            onClick={() =>
              onStart(
                visibleTeams,
                target,
                round,
                enabledCategories,
                enabledDifficulties,
                customWordsText.split("\n").map((s) => s.trim()).filter(Boolean)
              )
            }
          >
            <Play className="mr-2 h-5 w-5" />
            {t("startGame")}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function TeamSetupCard({
  label,
  team,
  setTeam,
  excludeColors,
}: {
  label: string
  team: Team
  setTeam: (t: Team) => void
  excludeColors: string[]
}) {
  const { t, lang } = useI18n()
  return (
    <div className={`rounded-2xl bg-linear-to-br ${team.color} p-0.5 shadow-md`}>
      <div className="rounded-2xl bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-linear-to-br text-2xl">
            <span>{team.emoji}</span>
          </div>
          <span className="font-semibold text-muted-foreground">{label}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            value={team.name}
            maxLength={28}
            placeholder={t("teamNamePlaceholder")}
            onChange={(e) => setTeam({ ...team, name: e.target.value })}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((c) => {
            const selected = team.color === c.gradient
            const disabled = excludeColors.includes(c.gradient)
            return (
              <button
                key={c.gradient}
                type="button"
                disabled={disabled}
                onClick={() => setTeam({ ...team, color: c.gradient, emoji: c.emoji })}
                className={`relative grid h-10 w-10 place-items-center rounded-xl bg-linear-to-br text-xl shadow transition ${
                  c.gradient
                } ${disabled ? "opacity-30 cursor-not-allowed" : "hover:scale-110"} ${
                  selected ? "ring-4 ring-offset-2 ring-offset-card ring-foreground/40" : ""
                }`}
                aria-label={c.name[lang]}
              >
                {c.emoji}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────── Страница ────────────────────────────── */

export default function Home() {
  const reducer = useMemo(() => makeReducer(), [])
  const [state, dispatch] = useReducer(reducer, initialState)
  const [showRules, setShowRules] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showAchievements, setShowAchievements] = useState(false)
  const [showMultiplayer, setShowMultiplayer] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showGameBoard, setShowGameBoard] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const { lang, toggle: toggleLang } = useLang()

  // Полноэкранные плавающие «+N» при угаданном слове
  const [floatingScore, setFloatingScore] = useState<{ points: number; key: number; emoji: string } | null>(null)

  // ─── Мультиплеер ───
  const mpClientRef = useRef<MultiplayerClient | null>(null)
  const mpRoleRef = useRef<"host" | "guest" | null>(null)
  const mpSyncModeRef = useRef<"host" | "sync" | null>(null)
  const [mpStatus, setMpStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected")
  const [mpMembers, setMpMembers] = useState(1)
  const [mpError, setMpError] = useState<string | null>(null)
  // ВАЖНО: ref для защиты от циклов синхронизации
  const isApplyingRemoteRef = useRef(false)

  // ─── WordPicker: обновляется при изменении customWords/enabledCategories/enabledDifficulties ───
  const pickerRef = useRef<WordPicker>(new WordPicker())
  useEffect(() => {
    pickerRef.current = new WordPicker(state.customWords, state.enabledCategories, state.enabledDifficulties)
  }, [state.customWords, state.enabledCategories, state.enabledDifficulties])

  // ─── Восстановление состояния из localStorage при загрузке ───
  useEffect(() => {
    // Применяем сохранённые настройки звука и вибрации (из SettingsDialog)
    try {
      const s = localStorage.getItem("nastolka-sound-enabled")
      const h = localStorage.getItem("nastolka-haptic-enabled")
      if (s !== null) setMuted(s !== "true")
      if (h !== null) setHapticsEnabled(h === "true")
    } catch {
      // ignore
    }
    try {
      // Сначала пробуем восстановить активную игру
      const saved = localStorage.getItem(STATE_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<State>
        const parsedPhase = parsed.phase as Phase | undefined
        // Восстанавливаем только из «безопасных» фаз — активные фазы перед
        // сохранением уже конвертируются в "ready", но если в localStorage
        // оказалась активная фаза (старая версия/чужая запись), откатываемся в "ready".
        const isRestorable = parsedPhase && RESTORABLE_PHASES.includes(parsedPhase)
        const isActive = parsedPhase && ACTIVE_PHASES.includes(parsedPhase)
        if (isRestorable || isActive) {
          if (isActive) {
            parsed.phase = "ready"
            parsed.currentMethod = null
            parsed.currentWord = null
            parsed.wordRevealed = false
            parsed.secondsLeft = parsed.roundSeconds ?? initialState.roundSeconds
            parsed.lastRoundResult = null
            parsed.lastRoundPoints = 0
            parsed.countdownSeconds = 0
          }
          parsed.multiplier = parsed.multiplier ?? 1
          parsed.lastRoundBasePoints = parsed.lastRoundBasePoints ?? 0
          parsed.lastRoundMultiplier = parsed.lastRoundMultiplier ?? 1
          // Миграция: добавляем chips командам, если их нет (старые сейвы)
          if (parsed.teams) {
            parsed.teams = parsed.teams.map((t) => ({
              ...t,
              chips: t.chips ?? initialChips(),
            }))
          }
          dispatch({ type: "HYDRATE", state: { ...initialState, ...parsed } as State })
        }
      } else {
        // Если активной игры нет — восстанавливаем настройки setup
        const settings = localStorage.getItem(SETTINGS_STORAGE_KEY)
        if (settings) {
          const s = JSON.parse(settings) as Partial<State>
          const restoredTeams = (s.teams && s.teams.length >= 2 ? s.teams : initialState.teams).map((t) => ({
            ...t,
            chips: t.chips ?? initialChips(),
            score: 0, // на setup всегда обнуляем
          }))
          dispatch({
            type: "HYDRATE",
            state: {
              ...initialState,
              teams: restoredTeams,
              targetScore: s.targetScore ?? initialState.targetScore,
              roundSeconds: s.roundSeconds ?? initialState.roundSeconds,
              enabledCategories: s.enabledCategories ?? [],
              enabledDifficulties: s.enabledDifficulties ?? [],
              customWords: s.customWords ?? [],
            },
          })
        }
      }
    } catch {
      // ignore parse errors
    }
    setHydrated(true)
  }, [])

  // ─── Мультиплеер: обработчики событий от сервера ───
  const handleMpConnect = useCallback(
    (client: MultiplayerClient, _role: "host" | "guest", _code: string, syncMode: "host" | "sync") => {
      mpClientRef.current = client
      mpRoleRef.current = _role
      mpSyncModeRef.current = syncMode
      setMpStatus("connected")
      setMpError(null)
      // Слушаем обновления состояния от других участников
      client.on('state-update', (payload) => {
        if (!payload?.state) return
        // В режиме хост гости получают состояние от хоста.
        // В режиме sync — любой участник может отправлять.
        isApplyingRemoteRef.current = true
        dispatch({ type: "HYDRATE", state: payload.state })
        // Сбрасываем флаг в следующем тике
        setTimeout(() => { isApplyingRemoteRef.current = false }, 0)
      })
      // Слушаем запросы состояния от новых участников
      client.on('state-requested', (payload) => {
        // Отправляем наше состояние новому участнику
        client.sendStateTo(payload.from, state)
      })
      client.on('peer-joined', (payload) => setMpMembers(payload.members))
      client.on('peer-left', (payload) => setMpMembers(payload.members))
      // Если мы гость — запрашиваем текущее состояние у хоста
      if (_role === "guest") {
        setTimeout(() => client.requestState(), 500)
      }
    },
    [state],
  )

  // ─── Мультиплеер: отправляем наше состояние при каждом изменении ───
  useEffect(() => {
    if (!hydrated) return
    if (mpStatus !== "connected") return
    if (isApplyingRemoteRef.current) return  // не отправляем то, что только что получили
    if (!mpClientRef.current) return
    if (state.phase === "setup") return  // не синхронизируем setup
    // В режиме host: только хост отправляет состояние (гости только слушают)
    // В режиме sync: любой отправляет
    if (mpSyncModeRef.current === "host" && mpRoleRef.current !== "host") return
    mpClientRef.current.sendState(state)
  }, [state, mpStatus, hydrated])

  // ─── Мультиплеер: в режиме host гости не могут действовать (UI блокируется) ───
  const isMpGuestLocked =
    mpStatus === "connected" &&
    mpSyncModeRef.current === "host" &&
    mpRoleRef.current === "guest"

  // ─── Сохранение состояния в localStorage при изменениях ───
  useEffect(() => {
    if (!hydrated) return
    try {
      // Не сохраняем промежуточные фазы (rolling / playing / task / method), чтобы при перезагрузке вернуться к началу хода
      if (state.phase === "setup") {
        // Сохраняем настройки setup, чтобы при следующем запуске они восстановились
        const settings = {
          teams: state.teams,
          targetScore: state.targetScore,
          roundSeconds: state.roundSeconds,
          enabledCategories: state.enabledCategories,
          enabledDifficulties: state.enabledDifficulties,
          customWords: state.customWords,
        }
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
        localStorage.removeItem(STATE_STORAGE_KEY)
        return
      }
      const snapshot: State = { ...state }
      if (snapshot.phase === "rolling" || snapshot.phase === "method" || snapshot.phase === "task" || snapshot.phase === "countdown" || snapshot.phase === "playing") {
        snapshot.phase = "ready"
        snapshot.currentMethod = null
        snapshot.currentWord = null
        snapshot.wordRevealed = false
        snapshot.secondsLeft = snapshot.roundSeconds
        snapshot.lastRoundResult = null
        snapshot.lastRoundPoints = 0
      }
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(snapshot))
      // Также сохраняем настройки — чтобы они пережили game_over → новая игра
      const settings = {
        teams: state.teams,
        targetScore: state.targetScore,
        roundSeconds: state.roundSeconds,
        enabledCategories: state.enabledCategories,
        enabledDifficulties: state.enabledDifficulties,
        customWords: state.customWords,
      }
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // ignore quota errors
    }
  }, [state, hydrated])

  /* Бросок кубика: запускаем анимацию, через 1.4с — фиксируем результат */
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleRoll = useCallback(() => {
    unlockAudio()
    playDiceRoll(1400)
    hapticRoll()
    dispatch({ type: "ROLL" })
    if (rollTimer.current) clearTimeout(rollTimer.current)
    rollTimer.current = setTimeout(() => {
      const method = rollDie()
      const word = pickerRef.current.next()
      dispatch({ type: "ROLL_RESULT", method, word })
    }, 1500)
  }, [])

  useEffect(() => {
    return () => {
      if (rollTimer.current) clearTimeout(rollTimer.current)
    }
  }, [])

  /* ─── Горячие клавиши ─── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Не срабатываем, если фокус в input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return
      // Не срабатываем, если диалог открыт
      if (showRules || showHistory || showAchievements || showMultiplayer || showSettings) return
      if (isMpGuestLocked) return

      switch (e.key.toLowerCase()) {
        case " ":  // Space — бросить кубик / угадали / передать ход
          e.preventDefault()
          if (state.phase === "ready" && !isMpGuestLocked) handleRoll()
          else if (state.phase === "playing" && !state.paused) dispatch({ type: "SCORE" })
          else if (state.phase === "round_end") dispatch({ type: "NEXT_TURN" })
          break
        case "s":  // S — пропустить
          if (state.phase === "playing" && !state.paused) dispatch({ type: "SKIP" })
          break
        case "p":  // P — пауза
          if (state.phase === "playing") dispatch({ type: state.paused ? "RESUME" : "PAUSE" })
          break
        case "r":  // R — заменить слово
          if (state.phase === "playing" && !state.paused && state.currentWord) {
            playSwap()
            dispatch({ type: "SWAP_WORD", word: pickerRef.current.swap(state.currentWord.word) })
          }
          break
        case "escape":  // Esc — закрыть диалог
          if (showRules) setShowRules(false)
          else if (showHistory) setShowHistory(false)
          else if (showAchievements) setShowAchievements(false)
          else if (showMultiplayer) setShowMultiplayer(false)
          else if (showSettings) setShowSettings(false)
          break
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [state.phase, state.paused, showRules, showHistory, showAchievements, showMultiplayer, showSettings, isMpGuestLocked])

  /* Таймер раунда + тик-звук в последние 10 секунд */
  const lastTickRef = useRef<number>(-1)
  useEffect(() => {
    if (state.phase !== "playing") {
      lastTickRef.current = -1
      return
    }
    const id = setInterval(() => dispatch({ type: "TICK" }), 1000)
    return () => clearInterval(id)
  }, [state.phase])

  useEffect(() => {
    if (state.phase !== "playing") return
    if (state.secondsLeft <= 10 && state.secondsLeft > 0 && state.secondsLeft !== lastTickRef.current) {
      lastTickRef.current = state.secondsLeft
      playTick(state.secondsLeft <= 5)
      hapticTick()
    }
  }, [state.secondsLeft, state.phase])

  /* Отсчёт 3-2-1-Старт! перед началом раунда */
  useEffect(() => {
    if (state.phase !== "countdown") return
    playTick(true)
    hapticTick()
    const id = setTimeout(() => dispatch({ type: "COUNTDOWN_TICK" }), 1000)
    return () => clearTimeout(id)
  }, [state.phase, state.countdownSeconds])

  /* Свайпы на мобильных: вправо — угадали, влево — пропустить */
  useEffect(() => {
    if (state.phase !== "playing" || state.paused) return
    let startX = 0
    let startY = 0
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        startX = e.touches[0].clientX
        startY = e.touches[0].clientY
      }
    }
    const onEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 0) return
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      // Горизонтальный свайп (больше 100px, меньше 50px вертикали)
      if (Math.abs(dx) > 100 && Math.abs(dy) < 50) {
        if (dx > 0) {
          dispatch({ type: "SCORE" })
          hapticScore()
        } else {
          dispatch({ type: "SKIP" })
          hapticSkip()
        }
      }
    }
    window.addEventListener("touchstart", onStart, { passive: true })
    window.addEventListener("touchend", onEnd, { passive: true })
    return () => {
      window.removeEventListener("touchstart", onStart)
      window.removeEventListener("touchend", onEnd)
    }
  }, [state.phase, state.paused])

  /* Звук при завершении раунда */
  const lastResultRef = useRef<string>("")
  useEffect(() => {
    if (state.phase === "round_end" && state.lastRoundResult && state.lastRoundResult !== lastResultRef.current) {
      lastResultRef.current = state.lastRoundResult
      if (state.lastRoundResult === "scored") {
        // За большие очки (≥10) — особый богатый звук
        if (state.lastRoundPoints >= 10) playBigScore()
        else playCorrect()
        hapticScore()
        // Полноэкранное «+N» с эмодзи команды
        const team = state.teams[state.activeTeam]
        setFloatingScore({
          points: state.lastRoundPoints,
          key: Date.now(),
          emoji: team?.emoji ?? "🎯",
        })
        // Маленькое конфетти за каждое угаданное слово
        confetti({
          particleCount: 30 + Math.min(state.lastRoundPoints * 4, 60),
          spread: 70,
          startVelocity: 35,
          decay: 0.92,
          scalar: 0.9,
          origin: { x: 0.5, y: 0.6 },
          colors: ["#10b981", "#34d399", "#fbbf24", "#f97316", "#a78bfa"],
          ticks: 120,
        })
      } else {
        playSkip()
        hapticSkip()
      }
    }
    if (state.phase !== "round_end") lastResultRef.current = ""
    // Время вышло отдельно — это skipped, но другой звук
    if (state.phase === "round_end" && state.lastRoundResult === "skipped" && state.secondsLeft === 0) {
      playTimeUp()
    }
  }, [state.phase, state.lastRoundResult, state.secondsLeft, state.lastRoundPoints, state.activeTeam, state.teams])

  /* Авто-скрытие плавающих «+N» через 2 секунды */
  useEffect(() => {
    if (!floatingScore) return
    const tid = setTimeout(() => setFloatingScore(null), 2000)
    return () => clearTimeout(tid)
  }, [floatingScore])

  /* Звук «ваш ход» при переходе в фазу ready (новый ход команды) */
  const prevPhaseRef = useRef<Phase>(state.phase)
  useEffect(() => {
    // Только при переходе к "ready" из другой фазы (round_end / game_over → restart)
    if (state.phase === "ready" && prevPhaseRef.current !== "ready") {
      playTeamActive()
    }
    prevPhaseRef.current = state.phase
  }, [state.phase])

  /* Конфетти + звук победы + запись в глобальную статистику */
  useEffect(() => {
    if (state.phase !== "game_over" || state.winner === null) return
    playWin()
    hapticWin()
    // Записываем достижение
    const scoredRounds = state.history.filter((h) => h.result === "scored")
    const scored = scoredRounds.length
    const skipped = state.history.length - scored
    recordGameComplete({
      rounds: state.history.length,
      scored,
      skipped,
      swaps: state.swapsUsed,
      winnerScore: state.teams[state.winner]?.score ?? 0,
      roundPoints: state.history.map((h) => h.points),
    })
    const colors = [
      ["#f43f5e", "#fb7185"],
      ["#10b981", "#34d399"],
      ["#f59e0b", "#fbbf24"],
      ["#8b5cf6", "#a78bfa"],
      ["#0ea5e9", "#38bdf8"],
    ][state.winner]
    // Финальный «марш» — 4 фазы конфетти
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

  const activeTeam = state.teams[state.activeTeam]
  const hasHistory = state.history.length > 0

  const i18nValue = useMemo(
    () => ({ lang, t: (key: Parameters<typeof t>[1]) => t(lang, key) }),
    [lang],
  )

  return (
    <I18nContext.Provider value={i18nValue}>
    <div className="nastolka-bg relative min-h-dvh w-full">
      <FloatingBubbles />

      <div className="relative z-10 flex min-h-dvh flex-col items-center">
        <HeaderBar
          onShowRules={() => setShowRules(true)}
          onShowHistory={() => setShowHistory(true)}
          onShowAchievements={() => setShowAchievements(true)}
          onShowMultiplayer={() => setShowMultiplayer(true)}
          onShowSettings={() => setShowSettings(true)}
          hasHistory={hasHistory}
          multiplayerStatus={mpStatus}
          lang={lang}
          onToggleLang={toggleLang}
        />

        {/* Карточка-заметка о Краже хода — показывается только во время игры */}
        <AnimatePresence>
          {state.phase !== "setup" && state.stealTeam >= 0 && state.stealTeam < state.teams.length && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="mt-3 w-full max-w-2xl px-4"
            >
              <div className="flex items-center gap-3 rounded-2xl bg-linear-to-r from-fuchsia-500/15 via-violet-500/15 to-pink-500/15 p-3 ring-1 ring-fuchsia-500/30 backdrop-blur-sm">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-fuchsia-500 to-violet-600 text-white shadow">
                  <Dices className="h-5 w-5" strokeWidth={2.4} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">
                    🎲 {t(lang, "stealNoticeTitle")} {state.teams[state.stealTeam].emoji} {state.teams[state.stealTeam].name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t(lang, "stealCardHint")}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="main-stage safe-x flex w-full max-w-5xl flex-1 flex-col items-center justify-center py-5 sm:py-8">
          <AnimatePresence mode="wait">
            {/* ─────────── SETUP ─────────── */}
            {state.phase === "setup" && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="w-full"
              >
                <SetupScreen
                  initialTeams={state.teams}
                  initialTarget={state.targetScore}
                  initialRound={state.roundSeconds}
                  initialCategories={state.enabledCategories}
                  initialDifficulties={state.enabledDifficulties}
                  initialCustomWords={state.customWords.join("\n")}
                  onStart={(teams, t, r, cats, diffs, customWords) => {
                    const freshPicker = new WordPicker(customWords, cats, diffs)
                    pickerRef.current = freshPicker
                    // Случайная команда получает фишку Кража хода
                    const stealTeam = Math.floor(Math.random() * teams.length)
                    dispatch({
                      type: "START_GAME",
                      teams,
                      targetScore: t,
                      roundSeconds: r,
                      enabledCategories: cats,
                      enabledDifficulties: diffs,
                      customWords,
                      word: freshPicker.next(),
                      stealTeam,
                    })
                  }}
                />
              </motion.div>
            )}

            {/* ─────────── READY ─────────── */}
            {state.phase === "ready" && (
              <motion.div
                key="ready"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="flex w-full flex-col items-center gap-6"
              >
                <TeamGrid
                  teams={state.teams}
                  activeTeam={state.activeTeam}
                  target={state.targetScore}
                />

                <Card className="w-full max-w-xl p-5 text-center shadow-xl sm:p-8">
                  <div className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    {t(lang, "teamTurnShort")}
                  </div>
                  <div className="mb-1 flex items-center justify-center gap-3">
                    <span className="text-5xl">{activeTeam.emoji}</span>
                    <div className="max-w-full wrap-break-word text-balance text-3xl font-black sm:text-4xl">{activeTeam.name}</div>
                  </div>
                  <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                    {t(lang, "onePlayerHint")}
                  </p>
                  {isMpGuestLocked && (
                    <div className="mt-4 rounded-xl bg-amber-500/15 p-3 text-sm text-amber-700 dark:text-amber-400">
                      {t(lang, "mpGuestCantAct")}
                    </div>
                  )}
                  <Button
                    size="lg"
                    className="mt-6 w-full max-w-xs text-base font-bold btn-roll-glow"
                    onClick={handleRoll}
                    disabled={isMpGuestLocked}
                  >
                    <Dices className="mr-2 h-5 w-5" />
                    {t(lang, "rollDice")}
                  </Button>
                </Card>
              </motion.div>
            )}

            {/* ─────────── ROLLING / METHOD / TASK ─────────── */}
            {(state.phase === "rolling" ||
              state.phase === "method" ||
              state.phase === "task") && (
              <motion.div
                key="dice-stage"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="flex w-full flex-col items-center gap-6"
              >
                <TeamGrid
                  teams={state.teams}
                  activeTeam={state.activeTeam}
                  target={state.targetScore}
                />

                <Card className="w-full max-w-2xl p-5 shadow-xl sm:p-8">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">{activeTeam.emoji}</span>
                      <span className="font-semibold">{activeTeam.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "BACK_TO_SETUP" })}>
                      {t(lang, "exit")}
                    </Button>
                  </div>

                  <div className="flex flex-col items-center gap-5 py-2">
                    <Dice
                      method={
                        state.phase === "rolling" ? null : getMethodForRound(state) ?? state.currentMethod
                      }
                      rolling={state.phase === "rolling"}
                      lang={lang}
                    />

                    {/* Подпись способа */}
                    {state.phase !== "rolling" && state.currentMethod && (
                      <div className="text-center">
                        <div className="mb-2">
                          <MethodBadge
                            method={getMethodForRound(state) ?? state.currentMethod}
                            large
                          />
                        </div>
                        <p className="mx-auto max-w-md text-sm text-muted-foreground">
                          {(getMethodForRound(state) ?? state.currentMethod).hint}
                        </p>
                      </div>
                    )}

                    {/* Если выпал Выбор — даём выбрать способ */}
                    {state.phase === "method" &&
                      state.currentMethod?.id === "choice" &&
                      state.chosenMethodForChoice === null && (
                        <div className="w-full max-w-md">
                          <div className="mb-2 text-center text-sm font-semibold text-muted-foreground">
                            {t(lang, "chooseMethod")}
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {(Object.values(METHODS) as BaseMethod[]).map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => dispatch({ type: "CHOOSE_METHOD", methodId: m.id, word: pickerRef.current.next() })}
                                className={`flex flex-col items-center gap-1 rounded-2xl ${m.color} p-3 font-bold uppercase tracking-wide shadow transition hover:scale-105`}
                              >
                                <MethodIcon id={m.id} />
                                <span className="text-xs">{m.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Если выпал Ещё раз — кнопка повторного броска */}
                    {state.phase === "method" && state.currentMethod?.id === "reroll" && (
                      <Button size="lg" onClick={handleRoll} className="font-bold">
                        <Dices className="mr-2 h-5 w-5" />
                        {t(lang, "reroll")}
                      </Button>
                    )}

                    {/* Обычный способ — показать слово */}
                    {state.phase === "method" &&
                      state.currentMethod &&
                      state.currentMethod.id !== "reroll" &&
                      (state.currentMethod.id !== "choice" || state.chosenMethodForChoice !== null) && (
                        <Button size="lg" onClick={() => dispatch({ type: "SHOW_WORD" })} className="font-bold">
                          <ArrowRight className="mr-2 h-5 w-5" />
                          {t(lang, "toWord")}
                        </Button>
                      )}

                    {/* Спрятанное слово */}
                    {state.phase === "task" && state.currentWord && (
                      <div className="w-full max-w-md rounded-2xl border border-dashed border-foreground/20 bg-muted/40 p-5 text-center">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          {t(lang, "wordHiddenLabel")}
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <EyeOff className="h-5 w-5 text-muted-foreground" />
                          <span className="text-2xl font-black tracking-widest text-foreground/70">
                            ••••••••
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {t(lang, "wordHiddenHint")}
                        </div>
                        <Button
                          size="lg"
                          variant="default"
                          className="mt-4 w-full font-bold"
                          onClick={() =>
                            dispatch({ type: isCountdownEnabled() ? "START_COUNTDOWN" : "REVEAL_WORD" })
                          }
                        >
                          <Eye className="mr-2 h-5 w-5" />
                          {t(lang, "showWord")}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ─────────── COUNTDOWN: 3-2-1-Старт! ─────────── */}
            {state.phase === "countdown" && state.currentWord && (
              <motion.div
                key="countdown"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex w-full flex-col items-center gap-6"
              >
                <Card className="w-full max-w-2xl p-8 text-center shadow-xl sm:p-12">
                  <div className="mb-4 flex items-center justify-center gap-2">
                    <span className="text-2xl">{activeTeam.emoji}</span>
                    <span className="font-semibold">{activeTeam.name}</span>
                  </div>
                  <div className="mb-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    {t(lang, "getReady")}
                  </div>
                  <motion.div
                    key={state.countdownSeconds}
                    initial={{ scale: 1.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 10 }}
                    className="text-7xl font-black sm:text-9xl"
                  >
                    {state.countdownSeconds > 0 ? state.countdownSeconds : t(lang, "goLabel")}
                  </motion.div>
                  <div className="mt-6 text-sm text-muted-foreground">
                    {t(lang, "wordHiddenHint")}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ─────────── PLAYING ─────────── */}
            {state.phase === "playing" && state.currentWord && (
              <motion.div
                key="playing"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="flex w-full flex-col items-center gap-4 sm:gap-6"
              >
                <TeamGrid
                  teams={state.teams}
                  activeTeam={state.activeTeam}
                  target={state.targetScore}
                />

                <Card className="w-full max-w-2xl p-5 shadow-xl sm:p-8">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{activeTeam.emoji}</span>
                      <span className="font-semibold">{activeTeam.name}</span>
                    </div>
                    <MethodBadge method={getMethodForRound(state)!} />
                  </div>

                  <div className="flex items-start gap-2 sm:gap-3">
                    <Timer secondsLeft={state.secondsLeft} total={state.roundSeconds} paused={state.paused} />
                    <button
                      type="button"
                      onClick={() => dispatch({ type: state.paused ? "RESUME" : "PAUSE" })}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 text-xs font-semibold text-muted-foreground transition hover:bg-foreground hover:text-background"
                    >
                      {state.paused ? (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          {t(lang, "resume")}
                        </>
                      ) : (
                        <>
                          <Pause className="h-3.5 w-3.5" />
                          {t(lang, "pause")}
                        </>
                      )}
                    </button>
                  </div>

                  <AnimatePresence>
                    {state.paused && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="mt-3 rounded-2xl border-2 border-dashed border-foreground/30 bg-muted/60 p-4 text-center"
                      >
                        <div className="flex items-center justify-center gap-2 text-sm font-semibold">
                          <Pause className="h-4 w-4" />
                          {t(lang, "pausedHint")}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t(lang, "pausedHint2")}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!state.paused && (
                    <div className="mt-4 rounded-3xl bg-linear-to-br from-amber-50 to-rose-50 p-4 text-center dark:from-amber-950/30 dark:to-rose-950/30 sm:mt-6 sm:p-6">
                      <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        <span>{categoryLabel(lang, state.currentWord.category)}</span>
                        {state.currentWord.difficulty && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${DIFFICULTY_COLORS[state.currentWord.difficulty]}`}
                          >
                            {difficultyLabel(lang, state.currentWord.difficulty)}
                          </span>
                        )}
                      </div>
                      <motion.div
                        key={state.currentWord.word}
                        initial={{ scale: 0.7, opacity: 0, rotate: -3 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 240, damping: 18 }}
                        className="my-2 wrap-break-word text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl"
                      >
                        {displayWord(state.currentWord, lang)}
                      </motion.div>
                      <div className="text-sm text-muted-foreground">
                        {t(lang, "explainByMethodPrefix")} {(() => {
                          const m = getMethodForRound(state)!
                          const labelKey: Record<MethodId, StringKey> = {
                            words: "methodWords", songs: "methodSongs", drawings: "methodDrawings",
                            gestures: "methodGestures", choice: "methodChoice", reroll: "methodReroll",
                          }
                          return t(lang, labelKey[m.id])
                        })()}
                      </div>
                      {/* Сколько очков за раунд */}
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <PointsBadge state={state} />
                        {state.multiplier > 1 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-linear-to-r from-amber-500 to-orange-500 px-3 py-1 text-xs font-black uppercase tracking-wider text-white shadow">
                            ×{state.multiplier} {t(lang, "multiplierActivated")}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Холст для способа Рисунком */}
                  {!state.paused && getMethodForRound(state)?.id === "drawings" && (
                    <div className="mt-4">
                      <DrawingCanvas resetKey={state.currentWord?.word} lang={lang} />
                    </div>
                  )}

                  {/* Запись песни для способа Песнями */}
                  {!state.paused && getMethodForRound(state)?.id === "songs" && (
                    <SongRecorder resetKey={state.currentWord?.word} lang={lang} />
                  )}

                  {/* Фишки команды (×2, +10 сек, +5 сек) */}
                  {!state.paused && <ChipsBar state={state} dispatch={dispatch} />}

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-6">
                    <Button
                      size="lg"
                      className="min-h-12 bg-emerald-500 text-white font-bold hover:bg-emerald-600"
                      onClick={() => {
                        dispatch({ type: "SCORE" })
                        hapticScore()
                      }}
                      disabled={state.paused}
                    >
                      <Check className="mr-2 h-5 w-5" />
                      {t(lang, "guessed")}
                    </Button>
                    <Button
                      size="lg"
                      className="min-h-12 font-bold border-destructive/30 text-destructive hover:bg-destructive/10"
                      variant="outline"
                      onClick={() => {
                        dispatch({ type: "SKIP" })
                        hapticSkip()
                      }}
                      disabled={state.paused}
                    >
                      <X className="mr-2 h-5 w-5" />
                      {t(lang, "skip")}
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playSwap()
                      if (state.currentWord) {
                        dispatch({ type: "SWAP_WORD", word: pickerRef.current.swap(state.currentWord.word) })
                      }
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t(lang, "swapWordLabel")}{state.swapsUsed > 0 ? ` · ${t(lang, "swapsCount")}: ${state.swapsUsed}` : ""}
                  </button>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    {t(lang, "scoredHint")}
                  </p>
                </Card>
              </motion.div>
            )}

            {/* ─────────── ROUND END ─────────── */}
            {state.phase === "round_end" && (
              <motion.div
                key="round_end"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="w-full max-w-xl"
              >
                <Card className="p-5 text-center shadow-xl sm:p-8">
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 220, damping: 14 }}
                    className={`mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full ${
                      state.lastRoundResult === "scored"
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {state.lastRoundResult === "scored" ? (
                      <Check className="h-10 w-10" strokeWidth={3} />
                    ) : (
                      <X className="h-10 w-10" strokeWidth={3} />
                    )}
                  </motion.div>

                  {state.lastRoundResult === "scored" ? (
                    <motion.div
                      initial={{ scale: 0, opacity: 0, rotate: -10 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
                      className="my-2"
                    >
                      <span className={`text-5xl font-black tabular-nums sm:text-7xl ${
                        state.lastRoundPoints >= 10
                          ? "bg-linear-to-br from-amber-400 via-orange-500 to-pink-600 bg-clip-text text-transparent"
                          : "text-emerald-500"
                      }`}>
                        +{state.lastRoundPoints}
                      </span>
                      <span className="ml-2 text-xl font-bold text-muted-foreground sm:text-2xl">
                        {pluralPoints(state.lastRoundPoints, lang)}
                      </span>
                    </motion.div>
                  ) : null}

                  <h2 className="text-2xl font-black">
                    {state.lastRoundResult === "scored"
                      ? t(lang, "teamGuessed")
                      : t(lang, "roundFailed")}
                  </h2>
                  {state.lastRoundResult === "scored" && state.lastRoundMultiplier > 1 && (
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-2 inline-block rounded-full bg-linear-to-r from-amber-500 to-orange-500 px-3 py-1 text-sm font-bold text-white shadow"
                    >
                      ×{state.lastRoundMultiplier}! {state.lastRoundBasePoints} → {state.lastRoundPoints} очков
                    </motion.p>
                  )}

                  {state.currentWord && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t(lang, "wordWasLabel")} <span className="font-bold text-foreground">{displayWord(state.currentWord, lang)}</span>
                    </p>
                  )}

                  <div className="mt-6 rounded-2xl bg-muted/50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {t(lang, "scoreLabel")}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
                      {state.teams.map((t, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-2xl">{t.emoji}</span>
                          <div className="text-left">
                            <div className="text-sm font-semibold">{t.name}</div>
                            <div className="text-2xl font-black">{t.score}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    size="lg"
                    className="mt-6 w-full font-bold"
                    onClick={() => dispatch({ type: "NEXT_TURN" })}
                  >
                    <ChevronRight className="mr-2 h-5 w-5" />
                    {t(lang, "passTurn")}
                  </Button>

                  {/* Отмена последнего раунда (откат очков, истории и фишек) */}
                  {state.history.length > 0 && (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "UNDO_ROUND" })}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {t(lang, "undoRound")}
                    </button>
                  )}
                  {/* Кнопка Кража хода — только если у текущей команды есть фишка */}
                  {state.teams[state.activeTeam]?.chips.stealTurn > 0 && (
                    <Button
                      size="lg"
                      className="mt-2 w-full bg-linear-to-r from-fuchsia-600 to-violet-700 font-bold text-white hover:from-fuchsia-700 hover:to-violet-800"
                      onClick={() => dispatch({ type: "STEAL_TURN" })}
                    >
                      <Dices className="mr-2 h-5 w-5" />
                      {t(lang, "stealTurnButton")}
                    </Button>
                  )}
                </Card>
              </motion.div>
            )}

            {/* ─────────── GAME OVER ─────────── */}
            {state.phase === "game_over" && state.winner !== null && (
              <motion.div
                key="game_over"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="w-full max-w-xl"
              >
                <Card className="p-5 text-center shadow-2xl sm:p-8">
                  <motion.div
                    initial={{ rotate: -20, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 220, damping: 12, delay: 0.1 }}
                    className="mx-auto mb-4 grid h-24 w-24 place-items-center rounded-full bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-lg"
                  >
                    <Trophy className="h-12 w-12" strokeWidth={2.4} />
                  </motion.div>
                  <div className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    {t(lang, "winner")}
                  </div>
                  <h2 className="mt-1 wrap-break-word text-3xl font-black sm:text-4xl">
                    {state.teams[state.winner].emoji} {state.teams[state.winner].name}
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    {t(lang, "finalScore")} {state.teams.map((t) => t.score).join(" : ")}
                  </p>

                  {/* Пьедестал — команды выстроены по очкам */}
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-6 flex items-end justify-center gap-2"
                  >
                    {(() => {
                      const ranked = state.teams
                        .map((tm, idx) => ({ ...tm, originalIdx: idx }))
                        .sort((a, b) => b.score - a.score)
                      const medals = ["🥇", "🥈", "🥉", "🏅"]
                      const heights = [120, 90, 70, 60]
                      const podium = [
                        "from-amber-400/30 to-orange-500/30 ring-amber-400/40",
                        "from-slate-300/30 to-slate-400/30 ring-slate-400/40",
                        "from-orange-700/30 to-amber-800/30 ring-orange-600/40",
                        "from-violet-400/30 to-purple-500/30 ring-violet-400/40",
                      ]
                      return ranked.map((tm, rank) => (
                        <motion.div
                          key={tm.originalIdx}
                          initial={{ opacity: 0, y: 50 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6 + rank * 0.15, type: "spring", stiffness: 220, damping: 14 }}
                          className="flex flex-1 flex-col items-center"
                        >
                          <div className="mb-1 text-3xl">{medals[Math.min(rank, medals.length - 1)]}</div>
                          <div className="text-2xl">{tm.emoji}</div>
                          <div className="max-w-full truncate text-xs font-semibold opacity-80">{tm.name}</div>
                          <div className="text-lg font-black">{tm.score}</div>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: heights[Math.min(rank, heights.length - 1)] }}
                            transition={{ delay: 0.7 + rank * 0.15, type: "spring", stiffness: 200, damping: 18 }}
                            className={`mt-2 flex w-full items-start justify-center rounded-t-xl bg-linear-to-b p-2 ring-1 ${
                              podium[Math.min(rank, podium.length - 1)]
                            }`}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              #{rank + 1}
                            </span>
                          </motion.div>
                        </motion.div>
                      ))
                    })()}
                  </motion.div>

              {state.history.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t(lang, "roundsPlayed")} {state.history.length} · {t(lang, "swapsCount")}: {state.swapsUsed}
                    </p>
                  )}

                  {/* MVP — лучшее слово игры */}
                  {(() => {
                    const scored = state.history.filter((h) => h.result === "scored" && h.points > 0)
                    if (scored.length === 0) return null
                    const mvp = scored.reduce((best, cur) => (cur.points > best.points ? cur : best), scored[0])
                    const mvpTeam = state.teams[mvp.team]
                    if (!mvpTeam) return null
                    const methodLabels: Record<MethodId, string> = {
                      words: t(lang, "methodWords"),
                      songs: t(lang, "methodSongs"),
                      drawings: t(lang, "methodDrawings"),
                      gestures: t(lang, "methodGestures"),
                      choice: t(lang, "methodChoice"),
                      reroll: t(lang, "methodReroll"),
                    }
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1 }}
                        className="mt-4 rounded-2xl bg-linear-to-br from-amber-400/20 via-orange-400/20 to-rose-400/20 p-4 ring-1 ring-amber-400/30"
                      >
                        <div className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                          {t(lang, "bestRound")}
                        </div>
                        <div className="mt-2 flex items-center justify-center gap-3">
                          <span className="text-2xl">{mvpTeam.emoji}</span>
                          <div className="text-center">
                            <div className="text-xl font-black">{displayWord(mvp, lang)}</div>
                            <div className="text-xs text-muted-foreground">
                              {methodLabels[mvp.method]} · +{mvp.points} {pluralPoints(mvp.points, lang)}
                              {mvp.multiplier > 1 && ` (×${mvp.multiplier})`}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })()}

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Button
                      size="lg"
                      className="flex-1 font-bold"
                      onClick={() => {
                        const newSteal = Math.floor(Math.random() * state.teams.length)
                        dispatch({ type: "RESTART", word: pickerRef.current.next(), stealTeam: newSteal })
                      }}
                    >
                      <RotateCcw className="mr-2 h-5 w-5" />
                      {t(lang, "playAgain")}
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowHistory(true)}
                    >
                      <ListChecks className="mr-2 h-5 w-5" />
                      {t(lang, "gameStats")}
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 w-full"
                    onClick={() => setShowAchievements(true)}
                  >
                    <Award className="mr-2 h-4 w-4" />
                    {t(lang, "achievements")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 w-full"
                    onClick={() => dispatch({ type: "BACK_TO_SETUP" })}
                  >
                    <PartyPopper className="mr-2 h-4 w-4" />
                    {t(lang, "newGame")}
                  </Button>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="safe-bottom w-full max-w-5xl px-4 pt-2 text-center text-xs text-muted-foreground">
          {t(lang, "footerText")}
        </footer>
      </div>

      <RulesDialog open={showRules} onOpenChange={setShowRules} />
      <HistoryDialog open={showHistory} onOpenChange={setShowHistory} state={state} />
      <AchievementsDialog open={showAchievements} onOpenChange={setShowAchievements} />
      <MultiplayerDialog
        open={showMultiplayer}
        onOpenChange={setShowMultiplayer}
        onConnect={handleMpConnect}
        status={mpStatus}
        members={mpMembers}
        errorMessage={mpError}
        lang={lang}
      />
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />

      {/* Игровая доска (Монополия-стайл) — плавающая панель справа */}
      {state.phase !== "setup" && state.phase !== "game_over" && (
        <GameBoard
          teams={state.teams}
          targetScore={state.targetScore}
          open={showGameBoard}
          onToggle={() => setShowGameBoard((v) => !v)}
          lang={lang}
          activeTeamIdx={state.activeTeam}
          lastRound={
            state.lastRoundResult
              ? {
                  teamIdx: state.activeTeam,
                  points: state.lastRoundPoints,
                  result: state.lastRoundResult,
                }
              : null
          }
        />
      )}

      {/* Полноэкранные плавающие «+N» при угаданном слове */}
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
            <div className="flex items-center gap-3 rounded-3xl bg-linear-to-br from-emerald-500/90 to-teal-600/90 px-6 py-4 text-white shadow-2xl ring-2 ring-white/40 backdrop-blur-md">
              <span className="text-5xl">{floatingScore.emoji}</span>
              <div className="flex flex-col">
                <span className="text-6xl font-black leading-none drop-shadow-lg">+{floatingScore.points}</span>
                <span className="text-xs font-bold uppercase tracking-widest opacity-90">
                  {pluralPoints(floatingScore.points, lang)}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </I18nContext.Provider>
  )
}

/* ────────────────────────────── Мелкие компоненты ────────────────────────────── */

function Timer({ secondsLeft, total, paused = false }: { secondsLeft: number; total: number; paused?: boolean }) {
  const { t, lang } = useI18n()
  const danger = secondsLeft <= 10
  const critical = secondsLeft <= 5
  const pct = (secondsLeft / total) * 100
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <Clock className={`h-4 w-4 shrink-0 ${paused ? "" : "animate-pulse"}`} />
          <span className="truncate">{paused ? t("pause") : t("time")}</span>
        </div>
        <motion.div
          className={`shrink-0 font-mono text-base font-black tabular-nums sm:text-lg ${critical && !paused ? "text-rose-500" : danger && !paused ? "text-amber-500" : ""} ${paused ? "text-muted-foreground" : ""}`}
          animate={critical && !paused ? { scale: [1, 1.25, 1], opacity: [1, 0.7, 1] } : { scale: 1, opacity: 1 }}
          transition={critical ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
        >
          {secondsLeft} {t("secShort")}
        </motion.div>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className={`h-full rounded-full ${danger ? "bg-rose-500" : "bg-emerald-500"} ${paused ? "opacity-40" : ""}`}
          initial={{ width: "100%" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}

function MethodIcon({ id }: { id: MethodId }) {
  switch (id) {
    case "words": return <Type className="h-6 w-6" />
    case "songs": return <Music className="h-6 w-6" />
    case "drawings": return <Brush className="h-6 w-6" />
    case "gestures": return <Hand className="h-6 w-6" />
    case "choice": return <Sparkles className="h-6 w-6" />
    case "reroll": return <Dices className="h-6 w-6" />
  }
}

/* ────────────────────────────── История + статистика ────────────────────────────── */

function HistoryDialog({
  open,
  onOpenChange,
  state,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  state: State
}) {
  const { t, lang } = useI18n()
  const history = state.history
  // Статистика по командам и методам
  const stats = useMemo(() => {
    const byTeam: Record<number, { scored: number; total: number }> = {}
    for (let i = 0; i < state.teams.length; i++) byTeam[i] = { scored: 0, total: 0 }
    const byMethod: Record<MethodId, { scored: number; total: number }> = {
      words: { scored: 0, total: 0 },
      songs: { scored: 0, total: 0 },
      drawings: { scored: 0, total: 0 },
      gestures: { scored: 0, total: 0 },
      choice: { scored: 0, total: 0 },
      reroll: { scored: 0, total: 0 },
    }
    for (const e of history) {
      if (!byTeam[e.team]) byTeam[e.team] = { scored: 0, total: 0 }
      byTeam[e.team].total += 1
      if (e.result === "scored") byTeam[e.team].scored += 1
      byMethod[e.method].total += 1
      if (e.result === "scored") byMethod[e.method].scored += 1
    }
    return { byTeam, byMethod }
  }, [history, state.teams.length])

  const methodLabels: Record<MethodId, string> = {
    words: t("methodWords"),
    songs: t("methodSongs"),
    drawings: t("methodDrawings"),
    gestures: t("methodGestures"),
    choice: t("methodChoice"),
    reroll: t("methodReroll"),
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto nice-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <ListChecks className="h-6 w-6" />
            {t("historyTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("historyTotalRounds")} {history.length}. {t("historySwaps")} {state.swapsUsed}.
          </DialogDescription>
        </DialogHeader>

        {history.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t("achEmpty")}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Статистика по командам */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {state.teams.map((tm, i) => {
                const s = stats.byTeam[i] ?? { scored: 0, total: 0 }
                const successRate = s.total > 0 ? Math.round((s.scored / s.total) * 100) : 0
                return (
                  <div
                    key={i}
                    className={`rounded-2xl bg-linear-to-br ${tm.color} p-4 text-white shadow`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider opacity-90">
                      <span className="text-lg">{tm.emoji}</span>
                      <span className="truncate">{tm.name}</span>
                    </div>
                    <div className="mt-1 text-3xl font-black">{tm.score}</div>
                    <div className="text-xs opacity-80">
                      {t("historyGuessedOf").replace("{scored}", String(s.scored)).replace("{total}", String(s.total)).replace("{rate}", String(successRate))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Статистика по методам */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("historySuccessByMethod")}
              </div>
              <div className="space-y-1.5">
                {(["words", "songs", "drawings", "gestures", "choice"] as const).map((id) => {
                  const s = stats.byMethod[id]
                  if (s.total === 0) return null
                  const pct = Math.round((s.scored / s.total) * 100)
                  const m = METHODS[id]
                  return (
                    <div key={id} className="flex items-center gap-2 text-sm">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${m.color}`}>
                        <MethodIconSmall id={id} />
                      </span>
                      <span className="w-24 shrink-0 font-semibold">{methodLabels[id]}</span>
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full ${m.color.split(" ")[0]}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                        {s.scored}/{s.total} · {pct}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Лента раундов */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("historyRounds")}
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto nice-scroll pr-1">
                {[...history].reverse().map((e, idx) => {
                  const team = state.teams[e.team]
                  const m = METHODS[e.method] ?? SPECIAL_METHODS[e.method as "choice" | "reroll"]
                  return (
                    <div key={idx} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-sm">
                      <span className="text-base">{team.emoji}</span>
                      <span className="w-20 shrink-0 truncate font-semibold">{team.name}</span>
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded ${m.color}`}>
                        <MethodIconSmall id={e.method} />
                      </span>
                      <span className="flex-1 truncate">{displayWord(e, lang)}</span>
                      {e.result === "scored" ? (
                        <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <X className="h-4 w-4 shrink-0 text-destructive" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MethodIconSmall({ id }: { id: MethodId }) {
  switch (id) {
    case "words": return <Type className="h-3 w-3" />
    case "songs": return <Music className="h-3 w-3" />
    case "drawings": return <Brush className="h-3 w-3" />
    case "gestures": return <Hand className="h-3 w-3" />
    case "choice": return <Sparkles className="h-3 w-3" />
    case "reroll": return <Dices className="h-3 w-3" />
  }
}

function RulesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto nice-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Dices className="h-6 w-6" />
            {t("rulesTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("rulesDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm leading-relaxed">
          <p>{t("rulesIntro")}</p>

          <ul className="space-y-2">
            <li className="flex items-start gap-3 rounded-xl bg-emerald-500/10 p-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-500 text-white">
                <Type className="h-4 w-4" />
              </span>
              <div>
                <b>{t("methodWords")}</b> — {t("methodWordsHint")}
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl bg-rose-500/10 p-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-rose-500 text-white">
                <Music className="h-4 w-4" />
              </span>
              <div>
                <b>{t("methodSongs")}</b> — {t("methodSongsHint")}
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl bg-amber-500/10 p-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-500 text-white">
                <Brush className="h-4 w-4" />
              </span>
              <div>
                <b>{t("methodDrawings")}</b> — {t("methodDrawingsHint")}
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl bg-violet-500/10 p-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500 text-white">
                <Hand className="h-4 w-4" />
              </span>
              <div>
                <b>{t("methodGestures")}</b> — {t("methodGesturesHint")}
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl bg-sky-500/10 p-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-500 text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <b>{t("methodChoice")}</b> — {t("methodChoiceHint")}
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl bg-indigo-500/10 p-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-500 text-white">
                <Dices className="h-4 w-4" />
              </span>
              <div>
                <b>{t("methodReroll")}</b> — {t("methodRerollHint")}
              </div>
            </li>
          </ul>

          <div className="rounded-xl bg-muted/60 p-4">
            <div className="font-semibold">{t("rulesRound")}</div>
            <ol className="ml-4 mt-2 list-decimal space-y-1">
              <li>{t("rulesRound1")}</li>
              <li>{t("rulesRound2")}</li>
              <li>{t("rulesRound3")}</li>
              <li>{t("rulesRound4")}</li>
              <li>{t("rulesRound5")}</li>
              <li>{t("rulesRound6")}</li>
            </ol>
          </div>

          <div className="rounded-xl bg-linear-to-br from-amber-50 to-orange-50 p-4 dark:from-amber-950/30 dark:to-orange-950/30">
            <div className="font-semibold">{t("rulesPointsTitle")}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("rulesExample")}
              {t("rulesExampleDetail")}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("rulesByMethod")}</div>
                <ul className="mt-1 space-y-0.5">
                  <li>{t("rulesWords1")}</li>
                  <li>{t("rulesSongs2")}</li>
                  <li>{t("rulesDrawings2")}</li>
                  <li>{t("rulesGestures3")}</li>
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("rulesByDifficulty")}</div>
                <ul className="mt-1 space-y-0.5">
                  <li>{t("rulesEasy1")}</li>
                  <li>{t("rulesMedium2")}</li>
                  <li>{t("rulesHard3")}</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-linear-to-br from-fuchsia-50 to-pink-50 p-4 dark:from-fuchsia-950/30 dark:to-pink-950/30">
            <div className="font-semibold">{t("rulesChipsTitle")}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("rulesChipsHint")}
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li>
                <span className="inline-flex items-center gap-1 rounded-md bg-linear-to-br from-fuchsia-500 to-pink-600 px-2 py-0.5 text-xs font-bold text-white">×2</span>
                <b> ×2 (2 {t("rulesPieces")})</b> — {t("rulesChipX2")}
              </li>
              <li>
                <span className="inline-flex items-center gap-1 rounded-md bg-linear-to-br from-sky-500 to-cyan-600 px-2 py-0.5 text-xs font-bold text-white">+10 {t("secShort")}</span>
                <b> +10 {t("rulesSeconds")} (1 {t("rulesPieces")})</b> — {t("rulesChipPlus10")}
              </li>
              <li>
                <span className="inline-flex items-center gap-1 rounded-md bg-linear-to-br from-indigo-500 to-blue-600 px-2 py-0.5 text-xs font-bold text-white">+5 {t("secShort")}</span>
                <b> +5 {t("rulesSeconds")} (1 {t("rulesPieces")})</b> — {t("rulesChipPlus5")}
              </li>
              <li>
                <span className="inline-flex items-center gap-1 rounded-md bg-linear-to-br from-fuchsia-600 to-violet-700 px-2 py-0.5 text-xs font-bold text-white">🎲</span>
                <b> {t("rulesStealTurn")}</b> — {t("rulesStealHint")}
              </li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("rulesTip")}
            </p>
          </div>

          <p className="text-muted-foreground">
            {t("rulesWin")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
