"use client"

import { useEffect, useState } from "react"
import { Settings, Volume2, VolumeX, Vibrate, VibrateOff } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useI18n } from "@/hooks/i18n-context"

const SOUND_STORAGE = "nastolka-sound-enabled"
const HAPTIC_STORAGE = "nastolka-haptic-enabled"

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useI18n()
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [hapticEnabled, setHapticEnabled] = useState(true)

  useEffect(() => {
    try {
      const s = localStorage.getItem(SOUND_STORAGE)
      const h = localStorage.getItem(HAPTIC_STORAGE)
      if (s !== null) setSoundEnabled(s === "true")
      if (h !== null) setHapticEnabled(h === "true")
    } catch {}
  }, [])

  const toggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled)
    try { localStorage.setItem(SOUND_STORAGE, String(enabled)) } catch {}
    // Динамически импортируем, чтобы избежать циклических зависимостей
    import("@/lib/sounds").then(({ setMuted }) => setMuted(!enabled))
  }

  const toggleHaptic = (enabled: boolean) => {
    setHapticEnabled(enabled)
    try { localStorage.setItem(HAPTIC_STORAGE, String(enabled)) } catch {}
    import("@/lib/sounds").then(({ setHapticsEnabled }) => setHapticsEnabled(enabled))
    if (enabled && "vibrate" in navigator) navigator.vibrate(50)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Settings className="h-6 w-6" />
            {t("rules") === "Правила" ? "Настройки" : "Settings"}
          </DialogTitle>
          <DialogDescription>
            {t("rules") === "Правила" ? "Управление звуком и вибрацией" : "Sound and vibration controls"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Звук */}
          <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
            <div className="flex items-center gap-3">
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${soundEnabled ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </div>
              <div>
                <div className="font-semibold">{t("rules") === "Правила" ? "Звук" : "Sound"}</div>
                <div className="text-xs text-muted-foreground">
                  {t("rules") === "Правила" ? "Звуковые эффекты игры" : "Game sound effects"}
                </div>
              </div>
            </div>
            <Switch checked={soundEnabled} onCheckedChange={toggleSound} />
          </div>

          {/* Вибрация */}
          <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
            <div className="flex items-center gap-3">
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${hapticEnabled ? "bg-violet-500 text-white" : "bg-muted text-muted-foreground"}`}>
                {hapticEnabled ? <Vibrate className="h-5 w-5" /> : <VibrateOff className="h-5 w-5" />}
              </div>
              <div>
                <div className="font-semibold">{t("rules") === "Правила" ? "Вибрация" : "Vibration"}</div>
                <div className="text-xs text-muted-foreground">
                  {t("rules") === "Правила" ? "Тактильная отдача на телефоне" : "Haptic feedback on phone"}
                </div>
              </div>
            </div>
            <Switch checked={hapticEnabled} onCheckedChange={toggleHaptic} />
          </div>

          {/* Кнопка теста */}
          <Button variant="outline" size="sm" className="w-full" onClick={() => {
            if (soundEnabled) import("@/lib/sounds").then(({ playCorrect }) => playCorrect())
            if (hapticEnabled && "vibrate" in navigator) navigator.vibrate([100, 50, 100])
          }}>
            {t("rules") === "Правила" ? "Тест звука и вибрации" : "Test sound & vibration"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
