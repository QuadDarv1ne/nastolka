"use client"

import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, X, MapPin, Trophy, Flag, Star, Dices, History, Crown } from "lucide-react"
import type { Team } from "@/lib/types"
import { t, type Lang } from "@/lib/i18n"
import { playPieceFinish, playMilestone, playPieceHop, playSkippedBuzzer } from "@/lib/sounds"
import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react"

interface GameBoardProps {
  teams: Team[]
  targetScore: number
  open: boolean
  onToggle: () => void
  lang: Lang
  /** Индекс активной команды (для пульсации) */
  activeTeamIdx?: number
  /** Последний ход для подсветки и мини-истории */
  lastRound?: {
    teamIdx: number
    points: number
    result: "scored" | "skipped"
  } | null
}

interface ScoreChange {
  teamIdx: number
  teamEmoji: string
  teamName: string
  teamColor: string
  prevScore: number
  newScore: number
  points: number
  result: "scored" | "skipped"
  ts: number
}

/** Шаг анимации одной клетки — 180 мс (≈ как в настольной Монополии) */
const STEP_MS = 220

/**
 * Игровая доска как в Монополии — квадратная доска с клетками по периметру.
 * Фигурки команд (эмодзи) двигаются по периметру в зависимости от очков.
 * Старт — правый нижний угол, путь идёт против часовой стрелки.
 *
 * v24: настоящее пошаговое движение фишек по всем промежуточным клеткам
 * с восходящей мелодией hop-звука и светящимся следом.
 */
export function GameBoard({ teams, targetScore, open, onToggle, lang, activeTeamIdx, lastRound }: GameBoardProps) {
  // Размер сетки N: периметр N×N = 4N-4 >= targetScore+1
  const N = Math.max(3, Math.ceil((targetScore + 5) / 4))

  // Генерируем позиции по периметру: старт в правом нижнем углу, против часовой
  const perimeterPositions: Array<{ row: number; col: number }> = []
  perimeterPositions.push({ row: N - 1, col: N - 1 }) // GO (старт)
  for (let r = N - 2; r >= 0; r--) perimeterPositions.push({ row: r, col: N - 1 }) // правый столбец вверх
  for (let c = N - 2; c >= 0; c--) perimeterPositions.push({ row: 0, col: c }) // верхняя строка влево
  for (let r = 1; r <= N - 1; r++) perimeterPositions.push({ row: r, col: 0 }) // левый столбец вниз
  for (let c = 1; c <= N - 2; c++) perimeterPositions.push({ row: N - 1, col: c }) // нижняя строка вправо

  // Клетки 0..targetScore размещаем по периметру
  const cellsOnBoard = Array.from({ length: targetScore + 1 }, (_, i) => ({
    score: i,
    pos: perimeterPositions[i],
  }))

  const maxScore = Math.max(...teams.map((tm) => tm.score), 0)

  // Клетки-вехи (четверть, половина, три четверти)
  const isMilestoneCell = (cell: number) => {
    if (cell === 0 || cell === targetScore) return false
    return (
      cell === Math.floor(targetScore / 4) ||
      cell === Math.floor(targetScore / 2) ||
      cell === Math.floor((targetScore * 3) / 4)
    )
  }
  const milestones = new Set([
    Math.floor(targetScore / 4),
    Math.floor(targetScore / 2),
    Math.floor((targetScore * 3) / 4),
  ])

  // Размеры в зависимости от N
  const pieceSize = N <= 4 ? 32 : N <= 6 ? 26 : 22
  const numSize = N <= 4 ? "text-xs" : N <= 6 ? "text-[10px]" : "text-[9px]"

  /* ─── Вычисляем размер клетки в пикселях ─── */
  const boardRef = useRef<HTMLDivElement>(null)
  const [cellMetrics, setCellMetrics] = useState<{ cellSize: number; cellStride: number; cellPad: number }>({ cellSize: 0, cellStride: 0, cellPad: 0 })

  // Измеряем синхронно при монтировании
  useLayoutEffect(() => {
    if (!boardRef.current) return
    const measure = () => {
      if (!boardRef.current) return 0
      const allCells = Array.from(boardRef.current.querySelectorAll<HTMLDivElement>(':scope > div'))
      // Фильтруем только клетки периметра (relative flex flex-col)
      const perimeterCells = allCells.filter((c) => (c.className || '').includes('relative flex flex-col'))
      // Клетки идут в порядке: 0 (старт, правый нижний) → 1 (вверх) → ... → финиш
      // У клетки 0 col=N-1, row=N-1
      // У клетки 1 col=N-1, row=N-2 (на 1 шаг вверх)
      // Разница в координатах между cell 0 и cell 1 = cellStride (с учётом знака)
      if (perimeterCells.length < 2) return 0
      const boardRect = boardRef.current.getBoundingClientRect()
      const cell0 = perimeterCells[0].getBoundingClientRect()
      const cell1 = perimeterCells[1].getBoundingClientRect()
      const cellSize = cell0.width
      // Padding = расстояние от доски до верхнего-левого угла клетки 0 минус смещение из-за grid-позиции
      // Но проще: cellStride = |cell0.x - cell1.x| (если столбцы) или |cell0.y - cell1.y| (если строки)
      const dx = Math.abs(cell0.x - cell1.x)
      const dy = Math.abs(cell0.y - cell1.y)
      const cellStride = Math.max(dx, dy) // = cellSize + gap(2)
      // Pad = смещение левого-верхнего угла клетки 0 от доски минус (col*N-1)*cellStride
      // Но мы не знаем N здесь... используем простой подход:
      // pad = (cell0.x - boardRect.x) mod cellStride — это padding слева
      // или если (cell0.x - boardRect.x) < cellStride, то это и есть pad
      const leftOffset = cell0.x - boardRect.x
      const topOffset = cell0.y - boardRect.y
      // pad = остаток от деления на cellStride (это padding + половина gap)
      const cellPad = Math.min(leftOffset % cellStride, topOffset % cellStride)
      // Если оба offset < cellStride (т.е. клетка 0 в правом нижнем углу), то используем min
      const realPad = Math.min(leftOffset, topOffset) < cellStride ? Math.min(leftOffset, topOffset) : cellPad
      if (cellSize === 0) return 0
      setCellMetrics({
        cellSize,
        cellStride,
        cellPad: realPad,
      })
      return 1
    }
    // Синхронное измерение
    if (!measure()) {
      requestAnimationFrame(() => {
        measure()
        requestAnimationFrame(measure)
      })
    }
    // Подписываемся на ресайз
    const ro = new ResizeObserver(() => { measure() })
    ro.observe(boardRef.current)
    return () => ro.disconnect()
  }, [open])
  const { cellSize, cellStride, cellPad } = cellMetrics

  /* ─── Звуки + мини-история при изменении очков ─── */
  const prevScoresRef = useRef<Record<number, number>>({})
  const [history, setHistory] = useState<ScoreChange[]>([])
  // Текущая анимируемая фишка (для подсветки следа)
  const [animatingPiece, setAnimatingPiece] = useState<{ teamIdx: number; fromCell: number; toCell: number } | null>(null)
  const [trailCells, setTrailCells] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!open || cellSize === 0) return
    const prev = prevScoresRef.current
    let movedTeam: { idx: number; from: number; to: number } | null = null

    teams.forEach((team, idx) => {
      const oldScore = prev[idx] ?? 0
      const newScore = team.score
      if (newScore > oldScore) {
        movedTeam = { idx, from: oldScore, to: Math.min(newScore, targetScore) }
        // Записываем в мини-историю
        setHistory((h) => {
          const entry: ScoreChange = {
            teamIdx: idx,
            teamEmoji: team.emoji,
            teamName: team.name,
            teamColor: team.color,
            prevScore: oldScore,
            newScore: Math.min(newScore, targetScore),
            points: newScore - oldScore,
            result: "scored",
            ts: Date.now(),
          }
          return [entry, ...h].slice(0, 3)
        })
      } else if (newScore < oldScore) {
        // undo — откатываем историю
        setHistory((h) => h.filter((e) => !(e.teamIdx === idx && e.newScore === oldScore)).slice(0, 3))
      }
    })

    if (movedTeam) {
      const { idx, from, to } = movedTeam
      const steps = to - from
      // Звуки hop: на каждый шаг — восходящая нота, задержка STEP_MS
      for (let i = 0; i < steps; i++) {
        setTimeout(() => playPieceHop(i, steps), i * STEP_MS)
      }
      // Проверяем прохождение вех и финиша — воспроизводим в момент "прохождения"
      for (let s = from + 1; s <= to; s++) {
        if (s === targetScore) {
          setTimeout(() => playPieceFinish(), (s - from) * STEP_MS)
        } else if (milestones.has(s)) {
          setTimeout(() => playMilestone(), (s - from) * STEP_MS)
        }
      }

      // Подсветка следа: показываем пройденные клетки
      const passedCells = new Set<number>()
      for (let s = from; s <= to; s++) passedCells.add(s)
      setTrailCells(passedCells)
      setAnimatingPiece({ teamIdx: idx, fromCell: from, toCell: to })

      // Снимаем подсветку после завершения анимации
      const totalDuration = (steps + 0.5) * STEP_MS
      setTimeout(() => {
        setTrailCells(new Set())
        setAnimatingPiece(null)
      }, totalDuration)
    }

    // Обновляем prev
    const next: Record<number, number> = {}
    teams.forEach((team, idx) => { next[idx] = team.score })
    prevScoresRef.current = next
  }, [teams, targetScore, open, cellSize, milestones])

  // Подсветка последнего хода
  const lastHighlight = useMemo<{ cell: number; result: "scored" | "skipped"; key: number } | null>(() => {
    if (!lastRound) return null
    const team = teams[lastRound.teamIdx]
    if (!team) return null
    return { cell: team.score, result: lastRound.result, key: Date.now() }
  }, [lastRound, teams])

  const [hiddenKeys, setHiddenKeys] = useState<Set<number>>(new Set())
  useEffect(() => {
    if (!lastHighlight) return
    const tid = setTimeout(() => {
      setHiddenKeys((prev) => {
        const next = new Set(prev)
        next.add(lastHighlight.key)
        return next
      })
    }, lastHighlight.result === "scored" ? 2200 : 1500)
    return () => clearTimeout(tid)
  }, [lastHighlight])

  // Звук skipped
  useEffect(() => {
    if (!lastRound || lastRound.result !== "skipped") return
    playSkippedBuzzer()
  }, [lastRound])

  // Клетка-лидер — где находится ведущая команда (если счёт > 0)
  const leaderCellIdx = maxScore > 0 ? Math.min(maxScore, targetScore) : -1

  return (
    <>
      {/* Кнопка-переключатель — плавающая справа */}
      <button
        type="button"
        onClick={onToggle}
        className="fixed right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-2xl bg-linear-to-br from-violet-600 to-indigo-700 px-2 py-4 text-white shadow-lg transition hover:from-violet-700 hover:to-indigo-800"
        aria-label={t(lang, "gameBoard")}
      >
        <ChevronRight className={`h-5 w-5 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Панель с доской — выезжает справа */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="fixed right-0 top-0 z-30 h-full w-full max-w-sm overflow-y-auto nice-scroll bg-card/95 shadow-2xl backdrop-blur-md sm:max-w-md"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/80 px-4 py-3 backdrop-blur">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <MapPin className="h-5 w-5 text-violet-500" />
                {t(lang, "gameBoard")}
              </h2>
              <button
                type="button"
                onClick={onToggle}
                className="rounded-full bg-muted p-1.5 transition hover:bg-muted/70"
                aria-label={lang === "ru" ? "Закрыть" : "Close"}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 py-4">
              {/* Квадратная доска */}
              <div className="mx-auto mb-4 aspect-square w-full max-w-[340px]">
                <div
                  ref={boardRef}
                  className="relative grid h-full w-full gap-0.5 rounded-2xl bg-linear-to-br from-violet-100 to-indigo-100 p-[3px] dark:from-violet-950/40 dark:to-indigo-950/40"
                  style={{
                    gridTemplateColumns: `repeat(${N}, 1fr)`,
                    gridTemplateRows: `repeat(${N}, 1fr)`,
                  }}
                >
                  {/* Центральная область — лого с 3D-вращающимся кубиком */}
                  <div
                    className="flex flex-col items-center justify-center rounded-xl bg-linear-to-br from-violet-500/15 to-indigo-500/15 p-2 text-center ring-1 ring-violet-300/40 dark:ring-violet-700/40"
                    style={{
                      gridColumn: `2 / span ${N - 2}`,
                      gridRow: `2 / span ${N - 2}`,
                    }}
                  >
                    <motion.div
                      animate={{ rotateY: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <Dices className="h-8 w-8 text-violet-500" />
                    </motion.div>
                    <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                      {t(lang, "appName")}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {t(lang, "targetLabel")}: {targetScore}
                    </div>
                    <div className="mt-0.5 text-[9px] text-muted-foreground">
                      {t(lang, "startToFinish")}
                    </div>
                  </div>

                  {/* Клетки по периметру */}
                  {cellsOnBoard.map((cell) => {
                    const isFinish = cell.score === targetScore
                    const isStart = cell.score === 0
                    const isMile = isMilestoneCell(cell.score)
                    const isHighlighted =
                      lastHighlight?.cell === cell.score && !hiddenKeys.has(lastHighlight.key)
                    const isTrail = trailCells.has(cell.score)
                    const isLeaderCell = cell.score === leaderCellIdx && leaderCellIdx > 0 && !isFinish

                    return (
                      <div
                        key={cell.score}
                        title={
                          isFinish
                            ? `${t(lang, "finishLabel")} (${cell.score})`
                            : isStart
                            ? `${t(lang, "startLabel")} (0)`
                            : isLeaderCell
                            ? `${cell.score} 👑`
                            : isMile
                            ? `${cell.score} ★`
                            : `${cell.score}`
                        }
                        className={`relative flex flex-col items-center justify-center overflow-hidden rounded-md border text-center transition-colors duration-200 ${
                          isFinish
                            ? "border-amber-400 bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-md"
                            : isStart
                            ? "border-emerald-400 bg-linear-to-br from-emerald-400 to-teal-500 text-white shadow-md"
                            : isMile
                            ? "border-violet-300 bg-violet-100 dark:border-violet-700 dark:bg-violet-900/40"
                            : "border-border bg-card"
                        } ${
                          isTrail && !isFinish && !isStart
                            ? "bg-violet-200/60 dark:bg-violet-800/40"
                            : ""
                        } ${
                          isHighlighted
                            ? lastHighlight?.result === "scored"
                              ? "ring-2 ring-emerald-500 ring-offset-1 ring-offset-card"
                              : "ring-2 ring-rose-500 ring-offset-1 ring-offset-card"
                            : ""
                        }`}
                        style={{
                          gridColumn: `${cell.pos.col + 1} / span 1`,
                          gridRow: `${cell.pos.row + 1} / span 1`,
                        }}
                      >
                        {/* Номер/иконка клетки */}
                        <div
                          className={`font-bold leading-none ${
                            isFinish || isStart ? "text-white" : "text-muted-foreground"
                          } ${numSize}`}
                        >
                          {isFinish ? (
                            <Trophy className="mx-auto h-3.5 w-3.5" />
                          ) : isStart ? (
                            <Flag className="mx-auto h-3.5 w-3.5" />
                          ) : (
                            cell.score
                          )}
                        </div>

                        {/* Звезда для вехи */}
                        {isMile && !isLeaderCell && (
                          <Star className="absolute right-0.5 top-0.5 h-2 w-2 text-violet-400 fill-violet-400" />
                        )}

                        {/* Корона для клетки-лидера */}
                        {isLeaderCell && (
                          <motion.div
                            initial={{ scale: 0, rotate: -20 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 280, damping: 14 }}
                            className="absolute left-1/2 top-0.5 -translate-x-1/2"
                          >
                            <motion.div
                              animate={{ y: [0, -2, 0], rotate: [0, 5, -5, 0] }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                            >
                              <Crown className="h-3 w-3 text-amber-500 drop-shadow" fill="currentColor" />
                            </motion.div>
                          </motion.div>
                        )}

                        {/* Пульс при подсветке scored */}
                        {isHighlighted && lastHighlight?.result === "scored" && (
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0.8 }}
                            animate={{ scale: 1.6, opacity: 0 }}
                            transition={{ duration: 0.8, repeat: 1 }}
                            className="absolute inset-0 rounded-md border-2 border-emerald-500 pointer-events-none"
                          />
                        )}

                        {/* Пульс при подсветке skipped (красный) */}
                        {isHighlighted && lastHighlight?.result === "skipped" && (
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0.6 }}
                            animate={{ scale: 1.4, opacity: 0 }}
                            transition={{ duration: 0.6, repeat: 1 }}
                            className="absolute inset-0 rounded-md border-2 border-rose-500 pointer-events-none"
                          />
                        )}

                        {/* Подсветка следа при движении фишки */}
                        {isTrail && !isHighlighted && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 0.6, 0.3] }}
                            transition={{ duration: 0.4 }}
                            className="absolute inset-0 rounded-md bg-violet-400/30 pointer-events-none"
                          />
                        )}
                      </div>
                    )
                  })}

                  {/* Overlay: фишки команд — absolute, пошаговое движение */}
                  {cellSize > 0 && teams.map((team, idx) => {
                    const cellScore = Math.min(team.score, targetScore)
                    const cellPos = perimeterPositions[cellScore]
                    // X = cellPad + col * cellStride + cellSize/2 - pieceSize/2
                    // Y = cellPad + row * cellStride + cellSize/2 - pieceSize/2
                    // cellPad = 3px (padding доски), cellStride = cellSize + gap(2px)
                    const targetX = cellPad + cellPos.col * cellStride + cellSize / 2 - pieceSize / 2
                    const targetY = cellPad + cellPos.row * cellStride + cellSize / 2 - pieceSize / 2
                    const isActive = activeTeamIdx === idx
                    const isAnimating = animatingPiece?.teamIdx === idx

                    return (
                      <motion.div
                        key={team.emoji + idx}
                        className="absolute pointer-events-none z-20"
                        initial={false}
                        animate={{ x: targetX, y: targetY }}
                        transition={
                          isAnimating && animatingPiece
                            ? {
                                duration: (animatingPiece.toCell - animatingPiece.fromCell) * (STEP_MS / 1000),
                                ease: "easeInOut",
                              }
                            : { type: "spring", stiffness: 200, damping: 22 }
                        }
                        style={{ top: 0, left: 0, width: pieceSize, height: pieceSize }}
                      >
                        {/* Свечение под активной фишкой */}
                        {isActive && (
                          <motion.div
                            className="absolute inset-0 rounded-full"
                            style={{
                              boxShadow: "0 0 12px 4px rgba(168,85,247,0.6)",
                            }}
                            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                          />
                        )}

                        {/* Сама фишка — эмодзи в цветном круге */}
                        <motion.div
                          className={`relative grid h-full w-full place-items-center rounded-full bg-linear-to-br ${team.color} shadow-lg ring-2 ring-card`}
                          animate={
                            lastHighlight?.cell === cellScore && lastHighlight?.result === "skipped" && lastRound?.teamIdx === idx
                              ? { x: [0, -4, 4, -4, 4, 0] }
                              : { x: 0 }
                          }
                          transition={{ duration: 0.4 }}
                          style={{
                            fontSize: pieceSize * 0.55,
                          }}
                        >
                          {team.emoji}
                        </motion.div>

                        {/* Свечение scored — золотая вспышка */}
                        {lastHighlight?.cell === cellScore &&
                          lastHighlight?.result === "scored" &&
                          lastRound?.teamIdx === idx &&
                          !hiddenKeys.has(lastHighlight.key) && (
                            <motion.div
                              initial={{ scale: 1, opacity: 0.8 }}
                              animate={{ scale: 2.2, opacity: 0 }}
                              transition={{ duration: 1.2, repeat: 0 }}
                              className="absolute inset-0 rounded-full bg-amber-400/50 pointer-events-none"
                            />
                          )}
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              {/* Подсказка о направлении */}
              <div className="mb-3 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                <Flag className="h-3 w-3 text-emerald-500" />
                <span>{t(lang, "startLabel")}</span>
                <ChevronRight className="h-3 w-3" />
                <span>{t(lang, "counterclockwise")}</span>
                <ChevronRight className="h-3 w-3" />
                <Trophy className="h-3 w-3 text-amber-500" />
                <span>{t(lang, "finishLabel")}</span>
              </div>

              {/* Мини-история последних ходов */}
              {history.length > 0 && (
                <div className="mb-3 rounded-xl bg-muted/40 p-2.5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <History className="h-3 w-3" />
                    {lang === "ru" ? "Последние ходы" : "Recent moves"}
                  </div>
                  <div className="space-y-1">
                    <AnimatePresence>
                      {history.map((h, i) => (
                        <motion.div
                          key={h.ts + "-" + i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <span className={`grid h-5 w-5 place-items-center rounded-full bg-linear-to-br ${h.teamColor} text-[10px]`}>
                            {h.teamEmoji}
                          </span>
                          <span className="font-semibold">{h.prevScore}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{h.newScore}</span>
                          <span className="ml-auto text-muted-foreground">
                            +{h.points} {lang === "ru" ? "очк." : "pts"}
                          </span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Легенда — цвета команд */}
              <div className="rounded-xl bg-muted/40 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t(lang, "teamsLabel")}
                </div>
                <div className="space-y-1.5">
                  {teams.map((team, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ scale: 1.02, x: 2 }}
                      className={`flex cursor-default items-center justify-between rounded-lg px-1.5 py-1 transition ${
                        activeTeamIdx === i ? "bg-violet-500/10 ring-1 ring-violet-500/30" : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <motion.span
                          className={`grid h-6 w-6 place-items-center rounded-full bg-linear-to-br ${team.color} text-sm shadow-sm`}
                          animate={activeTeamIdx === i
                            ? { scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }
                            : { scale: 1, rotate: 0 }
                          }
                          whileHover={{ scale: 1.3, rotate: 10 }}
                          transition={{
                            scale: { duration: 1.5, repeat: activeTeamIdx === i ? Infinity : 0 },
                            rotate: { duration: 1.5, repeat: activeTeamIdx === i ? Infinity : 0 },
                          }}
                        >
                          {team.emoji}
                        </motion.span>
                        <span className="text-sm font-semibold">{team.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{team.score}</span>
                        <span className="text-xs text-muted-foreground">/ {targetScore}</span>
                        {team.score === maxScore && maxScore > 0 && (
                          <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            {t(lang, "leader")}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Прогресс до финиша */}
              <div className="mt-3 space-y-2">
                {teams.map((team, i) => {
                  const pct = Math.min(100, (team.score / targetScore) * 100)
                  return (
                    <div key={i}>
                      <div className="mb-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>
                          {team.emoji} {team.name}
                        </span>
                        <span>{Math.round(pct)}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <motion.div
                          className={`h-full rounded-full bg-linear-to-r ${team.color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ type: "spring", stiffness: 120, damping: 20 }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
