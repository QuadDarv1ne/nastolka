"use client"

import { useEffect, useState } from "react"
import { Award, Trash2, Trophy, Check, X, RefreshCw, ListChecks, Calendar } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  loadGlobalStats,
  resetGlobalStats,
  formatLastPlayed,
  type GlobalStats,
} from "@/lib/achievements"
import { useI18n } from "@/hooks/i18n-context"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function AchievementsDialog({ open, onOpenChange }: Props) {
  const { t } = useI18n()
  const [stats, setStats] = useState<GlobalStats | null>(() =>
    typeof window === "undefined" ? null : loadGlobalStats()
  )

  // Обновляем при каждом открытии, чтобы видеть актуальные данные после новой игры.
  // Чтение через requestAnimationFrame, чтобы не было setState in effect.
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      setStats(loadGlobalStats())
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  const handleReset = () => {
    if (confirm(t("achResetConfirm"))) {
      setStats(resetGlobalStats())
    }
  }

  const successRate =
    stats && stats.totalWordsGuessed + stats.totalWordsSkipped > 0
      ? Math.round(
          (stats.totalWordsGuessed /
            (stats.totalWordsGuessed + stats.totalWordsSkipped)) *
            100
        )
      : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto nice-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Award className="h-6 w-6" />
            {t("achTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("achDescription")}
          </DialogDescription>
        </DialogHeader>

        {!stats ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t("loadingText")}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Краткая сводка */}
            <div className="grid grid-cols-2 gap-3">
              <StatTile
                icon={<Trophy className="h-5 w-5" />}
                value={stats.totalGames}
                label={t("achGamesPlayed")}
                accent="from-amber-400 to-orange-500"
              />
              <StatTile
                icon={<span className="text-base font-black">Σ</span>}
                value={stats.totalPoints}
                label={t("achTotalPoints")}
                accent="from-violet-500 to-purple-600"
              />
              <StatTile
                icon={<Check className="h-5 w-5" />}
                value={stats.totalWordsGuessed}
                label={t("achWordsGuessed")}
                accent="from-emerald-400 to-teal-500"
              />
              <StatTile
                icon={<X className="h-5 w-5" />}
                value={stats.totalWordsSkipped}
                label={t("achWordsSkipped")}
                accent="from-rose-400 to-pink-500"
              />
              <StatTile
                icon={<RefreshCw className="h-5 w-5" />}
                value={stats.totalSwaps}
                label={t("achSwaps")}
                accent="from-sky-400 to-indigo-500"
              />
              <StatTile
                icon={<span className="text-base font-black">⚡</span>}
                value={stats.bestRoundPoints}
                label={t("achBestRound")}
                accent="from-fuchsia-500 to-pink-600"
              />
            </div>

            {/* Успешность */}
            <div className="rounded-2xl bg-muted/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ListChecks className="h-4 w-4" />
                  {t("achSuccessRate")}
                </div>
                <div className="text-lg font-black tabular-nums">{successRate}%</div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                  style={{ width: `${successRate}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {stats.totalWordsGuessed} {t("achWordsRatio")} {stats.totalWordsGuessed + stats.totalWordsSkipped} {t("achWords")}
              </p>
            </div>

            {/* Рекорды */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("achRecords")}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <RecordTile
                  label={t("achLongestGame")}
                  value={`${stats.longestGameRounds} ${t("achRounds")}`}
                />
                <RecordTile
                  label={t("achBestScore")}
                  value={`${stats.bestScore} ${t("pointsShort")}`}
                />
                <RecordTile
                  label={t("achBestRoundRecord")}
                  value={`${stats.bestRoundPoints} ${t("pointsShort")}`}
                />
                <RecordTile
                  label={t("achAveragePerGame")}
                  value={`${stats.totalGames > 0 ? Math.round(stats.totalPoints / stats.totalGames) : 0} ${t("pointsShort")}`}
                />
              </div>
            </div>

            {/* Последняя игра */}
            <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("achLastGame")}</span>
              <span className="font-semibold">{formatLastPlayed(stats.lastPlayedAt)}</span>
            </div>

            {/* Кнопка сброса */}
            {stats.totalGames > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="w-full text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("achReset")}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StatTile({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode
  value: number
  label: string
  accent: string
}) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${accent} p-4 text-white shadow`}>
      <div className="mb-1 opacity-90">{icon}</div>
      <div className="text-3xl font-black tabular-nums">{value}</div>
      <div className="text-xs font-medium opacity-90">{label}</div>
    </div>
  )
}

function RecordTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-bold">{value}</div>
    </div>
  )
}
