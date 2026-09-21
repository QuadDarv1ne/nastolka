"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Type, Music, Brush, Hand, Sparkles, Dices, type LucideIcon } from "lucide-react"
import type { Method, MethodId } from "@/lib/game-data"
import type { Lang, StringKey } from "@/lib/i18n"
import { DICE_FACES } from "@/lib/game-data"
import { t as translate } from "@/lib/i18n"

const ICONS: Record<string, LucideIcon> = { Type, Music, Brush, Hand, Sparkles, Dices }
const METHOD_LABEL_KEYS: Record<MethodId, StringKey> = {
  words: "methodWords", songs: "methodSongs", drawings: "methodDrawings",
  gestures: "methodGestures", choice: "methodChoice", reroll: "methodReroll",
}
const ROLLING_LABEL: Record<Lang, string> = { ru: "Бросок…", en: "Rolling…" }

interface DiceProps {
  method: Method | null
  rolling: boolean
  size?: number | string
  lang?: Lang
}

/**
 * Настоящий 3D-кубик с 6 гранями.
 * CSS 3D transforms: perspective, preserve-3d, translateZ.
 * Адаптивный через --dice CSS-переменную.
 */
export function Dice({ method, rolling, size = "min(220px, 62vw, 34svh)", lang = "ru" }: DiceProps) {
  const px = typeof size === "number" ? `${size}px` : size
  const boxStyle = { "--dice": px } as React.CSSProperties
  const faces = DICE_FACES
  const faceTransforms = [
    { transform: "translateZ(calc(var(--dice) / 2))" },
    { transform: "rotateY(180deg) translateZ(calc(var(--dice) / 2))" },
    { transform: "rotateY(90deg) translateZ(calc(var(--dice) / 2))" },
    { transform: "rotateY(-90deg) translateZ(calc(var(--dice) / 2))" },
    { transform: "rotateX(90deg) translateZ(calc(var(--dice) / 2))" },
    { transform: "rotateX(-90deg) translateZ(calc(var(--dice) / 2))" },
  ]
  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ ...boxStyle, width: "var(--dice)", height: "var(--dice)", perspective: "1200px" }}>
      <motion.div className="absolute left-1/2 -translate-x-1/2 rounded-full bg-black/30 blur-xl pointer-events-none"
        animate={rolling ? { width: "70%", height: 14, opacity: 0.5, scale: [1, 0.85, 1.15, 0.9, 1] } : { width: "55%", height: 18, opacity: 0.6 }}
        transition={{ duration: 0.5, ease: "easeOut", repeat: rolling ? Infinity : 0 }}
        style={{ bottom: "calc(var(--dice) * -0.07)" }} />
      <AnimatePresence>
        {rolling && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.1, 1] }} exit={{ opacity: 0, scale: 1 }}
            transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-3xl pointer-events-none" style={{ boxShadow: "0 0 calc(var(--dice) * 0.3) rgba(168,85,247,0.7)" }} />
        )}
      </AnimatePresence>
      <motion.div className="relative" style={{ width: "var(--dice)", height: "var(--dice)", transformStyle: "preserve-3d" }}
        animate={rolling
          ? { rotateX: [0, 180, 540, 900, 1260, 1620, 1800], rotateY: [0, 360, 720, 1080, 1440, 1620, 1800], rotateZ: [0, -90, 180, -270, 360, -180, 0], scale: [1, 0.95, 1.05, 0.98, 1.02, 0.99, 1], y: [0, -10, 0, -8, 0, -4, 0] }
          : { rotateX: 0, rotateY: 0, rotateZ: 0, scale: [1.15, 0.95, 1.05, 1], y: [0, -12, 0] }}
        transition={rolling ? { duration: 1.5, ease: [0.4, 0, 0.6, 1], repeat: Infinity } : { duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}>
        {faces.map((face, idx) => {
          const Icon = ICONS[face.icon] ?? Dices
          const isFront = idx === 0
          const fm = isFront && method ? method : face
          const gradient = `bg-linear-to-br ${fm.gradient}`
          return (
            <div key={idx} className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl shadow-2xl"
              style={{ ...faceTransforms[idx], backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
              <div className={`absolute inset-0 rounded-2xl ${gradient} ring-2 ring-white/40`} />
              <div className="absolute inset-2 rounded-xl bg-white/15 ring-1 ring-white/30" />
              <div className="absolute inset-0 rounded-2xl opacity-50" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 50%, rgba(0,0,0,0.15) 100%)" }} />
              <div className="relative z-10 flex flex-col items-center gap-2 px-[8%] text-center">
                <Icon className="text-white drop-shadow-lg" style={{ width: "calc(var(--dice) * 0.32)", height: "calc(var(--dice) * 0.32)" }} strokeWidth={2.4} />
                <span className="font-extrabold uppercase tracking-wide text-white drop-shadow-md" style={{ fontSize: "calc(var(--dice) * 0.1)" }}>
                  {translate(lang, METHOD_LABEL_KEYS[fm.id])}
                </span>
              </div>
              <div className="pointer-events-none absolute left-[6%] top-[6%] h-[5%] w-[5%] rounded-full bg-white/70" />
              <div className="pointer-events-none absolute right-[6%] top-[6%] h-[5%] w-[5%] rounded-full bg-white/70" />
              <div className="pointer-events-none absolute bottom-[6%] left-[6%] h-[5%] w-[5%] rounded-full bg-white/70" />
              <div className="pointer-events-none absolute bottom-[6%] right-[6%] h-[5%] w-[5%] rounded-full bg-white/70" />
            </div>
          )
        })}
      </motion.div>
      <AnimatePresence>
        {rolling && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="absolute left-1/2 top-full mt-4 -translate-x-1/2 text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
            {ROLLING_LABEL[lang]}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
