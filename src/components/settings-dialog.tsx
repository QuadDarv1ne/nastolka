"use client"

import { useEffect, useState } from "react"
import { Settings, Volume2, VolumeX, Vibrate, VibrateOff, Timer, TimerOff } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useI18n } from "@/hooks/i18n-context"
import { isMuted, setMuted, setHapticsEnabled, unlockAudio } from "@/lib/sounds"
import { readItem, writeItem } from "@/lib/storage"

const SOUND_STORAGE = "nastolka-sound-enabled"
const HAPTIC_STORAGE = "nastolka-haptic-enabled"
export const COUNTDOWN_STORAGE = "nastolka-countdown-enabled"

/** Включён ли отсчёт 3-2-1 перед раундом (по умолчанию — да) */
export function isCountdownEnabled(): boolean {
  return readItem(COUNTDOWN_STORAGE) !== "false"
}

/** Диалог настроек: звуковые эффекты, тактильная отдача, отсчёт 3-2-1 */
export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useI18n()
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [hapticEnabled, setHapticEnabled] = useState(true)
  const [countdownEnabled, setCountdownEnabled] = useState(true)

  useEffect(() => {
    // Читаем сохранённые настройки после гидратации (setState в эффекте — намеренно,
    // это канонический паттерн чтения клиентского состояния после монтирования)
    /* eslint-disable react-hooks/set-state-in-effect */
    const s = readItem(SOUND_STORAGE)
    const h = readItem(HAPTIC_STORAGE)
    const c = readItem(COUNTDOWN_STORAGE)
    if (s !== null) setSoundEnabled(s === "true")
    if (h !== null) setHapticEnabled(h === "true")
    if (c !== null) setCountdownEnabled(c === "true")
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const toggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled)
    writeItem(SOUND_STORAGE, String(enabled))
    setMuted(!enabled)
    if (enabled) unlockAudio()
  }

  const toggleHaptic = (enabled: boolean) => {
    setHapticEnabled(enabled)
    writeItem(HAPTIC_STORAGE, String(enabled))
    setHapticsEnabled(enabled)
    if (enabled && typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(50)
      } catch {
        // ignore
      }
    }
  }

  const toggleCountdown = (enabled: boolean) => {
    setCountdownEnabled(enabled)
    writeItem(COUNTDOWN_STORAGE, String(enabled))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Settings className="h-6 w-6" />
            {t("settingsTitle")}
          </DialogTitle>
          <DialogDescription>{t("settingsSubtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Звук */}
          <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
            <div className="flex items-center gap-3">
              <div
                className={`grid h-10 w-10 place-items-center rounded-xl ${
                  soundEnabled ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </div>
              <div>
                <div className="font-semibold">{t("soundLabel")}</div>
                <div className="text-xs text-muted-foreground">{t("soundHint")}</div>
              </div>
            </div>
            <Switch checked={soundEnabled} onCheckedChange={toggleSound} />
          </div>

          {/* Вибрация */}
          <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
            <div className="flex items-center gap-3">
              <div
                className={`grid h-10 w-10 place-items-center rounded-xl ${
                  hapticEnabled ? "bg-violet-500 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {hapticEnabled ? <Vibrate className="h-5 w-5" /> : <VibrateOff className="h-5 w-5" />}
              </div>
              <div>
                <div className="font-semibold">{t("vibrationLabel")}</div>
                <div className="text-xs text-muted-foreground">{t("vibrationHint")}</div>
              </div>
            </div>
            <Switch checked={hapticEnabled} onCheckedChange={toggleHaptic} />
          </div>

          {/* Отсчёт 3-2-1 */}
          <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
            <div className="flex items-center gap-3">
              <div
                className={`grid h-10 w-10 place-items-center rounded-xl ${
                  countdownEnabled ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {countdownEnabled ? <Timer className="h-5 w-5" /> : <TimerOff className="h-5 w-5" />}
              </div>
              <div>
                <div className="font-semibold">{t("countdownLabel")}</div>
                <div className="text-xs text-muted-foreground">{t("countdownHint")}</div>
              </div>
            </div>
            <Switch checked={countdownEnabled} onCheckedChange={toggleCountdown} />
          </div>

          {/* Кнопка теста */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              if (soundEnabled) unlockAudio()
              if (hapticEnabled && typeof navigator !== "undefined" && "vibrate" in navigator) {
                try {
                  navigator.vibrate([100, 50, 100])
                } catch {
                  // ignore
                }
              }
            }}
          >
            {t("testSoundVibration")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
