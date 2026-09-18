"use client"

import { motion } from "framer-motion"
import { Type, Music, Brush, Hand, Sparkles, Dices, type LucideIcon } from "lucide-react"
import type { Method, MethodId } from "@/lib/game-data"
import type { Lang } from "@/lib/i18n"
import type { StringKey } from "@/lib/i18n"

const ICONS: Record<string, LucideIcon> = {
  Type,
  Music,
  Brush,
  Hand,
  Sparkles,
  Dices,
}

// Локализованные ключи методов
const METHOD_LABEL_KEYS: Record<MethodId, StringKey> = {
  words: "methodWords",
  songs: "methodSongs",
  drawings: "methodDrawings",
  gestures: "methodGestures",
  choice: "methodChoice",
  reroll: "methodReroll",
}

// Импортируем t через i18n напрямую (Dice — презентационный компонент)
import { t as translate } from "@/lib/i18n"

interface DiceProps {
  method: Method | null
  rolling: boolean
  size?: number
  lang?: Lang
}

/**
 * Кубик для «Настолки» — большой, мягкий, мультяшный.
 * Во время броска быстро меняется лицо и трясётся корпус.
 * После остановки — крупная «лицевая» грань с иконкой и подписью.
 */
export function Dice({ method, rolling, size = 220, lang = "ru" }: DiceProps) {
  // Используем упрощённый «2D-кубик»: большая грань с иконкой + эффект тени
  const Icon = method ? ICONS[method.icon] ?? Dices : Dices
  const gradient = method
    ? `bg-gradient-to-br ${method.gradient}`
    : "bg-gradient-to-br from-slate-400 to-slate-600"

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Тень под кубиком */}
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-black/25 blur-xl"
        animate={rolling ? { width: size * 0.7, height: 14, opacity: 0.4 } : { width: size * 0.55, height: 18, opacity: 0.55 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        style={{ bottom: -16 }}
      />

      {/* Корпус кубика */}
      <motion.div
        className="relative grid place-items-center rounded-3xl shadow-2xl"
        style={{ width: size, height: size }}
        animate={
          rolling
            ? {
                x: [0, -8, 8, -6, 6, -4, 0],
                y: [0, -10, 6, -8, 4, -2, 0],
                rotate: [0, -8, 12, -10, 8, -4, 0],
              }
            : { x: 0, y: 0, rotate: 0 }
        }
        transition={
          rolling
            ? { duration: 1.4, ease: "easeInOut", repeat: Infinity }
            : { duration: 0.4, ease: "easeOut" }
        }
      >
        {/* Блик-внутренняя рамка */}
        <div
          className={`absolute inset-0 rounded-3xl ${gradient} ring-4 ring-white/40`}
        />
        <div className="absolute inset-2 rounded-2xl bg-white/10 ring-1 ring-white/30" />

        {/* Быстро меняющаяся «грань» во время броска */}
        {rolling && <RollingFaces size={size} />}

        {/* Финальная грань */}
        {!rolling && (
          <motion.div
            key={method?.id ?? "empty"}
            initial={{ scale: 0.6, opacity: 0, rotateY: -90 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="relative z-10 flex flex-col items-center gap-2 px-4 text-center"
          >
            <Icon className="text-white drop-shadow-lg" style={{ width: size * 0.36, height: size * 0.36 }} strokeWidth={2.4} />
            <span
              className="font-extrabold uppercase tracking-wide text-white drop-shadow-md"
              style={{ fontSize: size * 0.11 }}
            >
              {method ? translate(lang, METHOD_LABEL_KEYS[method.id]) : "—"}
            </span>
          </motion.div>
        )}

        {/* Точечки в углах — стилизация под кубик */}
        <div className="pointer-events-none absolute left-3 top-3 h-2.5 w-2.5 rounded-full bg-white/60" />
        <div className="pointer-events-none absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-white/60" />
        <div className="pointer-events-none absolute bottom-3 left-3 h-2.5 w-2.5 rounded-full bg-white/60" />
        <div className="pointer-events-none absolute bottom-3 right-3 h-2.5 w-2.5 rounded-full bg-white/60" />
      </motion.div>
    </div>
  )
}

/** Перебор граней во время броска */
function RollingFaces({ size }: { size: number }) {
  return (
    <motion.div
      className="absolute inset-0 grid place-items-center"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 0.18, repeat: Infinity, ease: "easeInOut" }}
        className="flex flex-col items-center gap-2"
      >
        <Dices className="text-white/80" style={{ width: size * 0.32, height: size * 0.32 }} strokeWidth={2.2} />
        <span className="text-xs font-bold uppercase tracking-widest text-white/80">
          Бросок…
        </span>
      </motion.div>
    </motion.div>
  )
}
