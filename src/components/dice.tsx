"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Type, Music, Brush, Hand, Sparkles, Dices, type LucideIcon } from "lucide-react"
import type { Method } from "@/lib/game-data"
import type { Lang } from "@/lib/i18n"
import { t, type StringKey } from "@/lib/i18n"
import { DICE_FACES } from "@/lib/game-data"

const ICONS: Record<string, LucideIcon> = {
  Type,
  Music,
  Brush,
  Hand,
  Sparkles,
  Dices,
}

const ROLLING_LABEL: Record<Lang, string> = {
  ru: "Бросок…",
  en: "Rolling…",
}

/** Map MethodId → i18n key for localized label */
const METHOD_LABEL_KEY: Record<string, StringKey> = {
  words: "methodWords",
  songs: "methodSongs",
  drawings: "methodDrawings",
  gestures: "methodGestures",
  choice: "methodChoice",
  reroll: "methodReroll",
}

/** Get localized label for a method */
function getMethodLabel(method: Method, lang: Lang): string {
  const key = METHOD_LABEL_KEY[method.id]
  return key ? t(lang, key) : method.label
}

interface DiceProps {
  /** Текущий выбранный метод (показывается после остановки) */
  method: Method | null
  /** Находится ли кубик в состоянии броска */
  rolling: boolean
  /** Размер в пикселях */
  size?: number
  /** Язык для подписи «Бросок…» */
  lang?: Lang
}

/**
 * Настоящий 3D-кубик с 6 гранями.
 * Использует CSS 3D transforms: perspective, preserve-3d, translateZ.
 * Грани: front, back, right, left, top, bottom — каждая со своим методом.
 *
 * При броске кубик вращается по всем 3 осям (rotateX/Y/Z) с ускорением и замедлением.
 * После остановки на front-грани показывается выбранный метод (локализованный).
 */
export function Dice({ method, rolling, size = 220, lang = "en" }: DiceProps) {
  const half = size / 2
  const faces = DICE_FACES

  // Все 6 граней: front, back, right, left, top, bottom
  const faceTransforms = [
    { transform: `translateZ(${half}px)`, name: "front" },          // front
    { transform: `rotateY(180deg) translateZ(${half}px)`, name: "back" },
    { transform: `rotateY(90deg) translateZ(${half}px)`, name: "right" },
    { transform: `rotateY(-90deg) translateZ(${half}px)`, name: "left" },
    { transform: `rotateX(90deg) translateZ(${half}px)`, name: "top" },
    { transform: `rotateX(-90deg) translateZ(${half}px)`, name: "bottom" },
  ]

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size, perspective: 1200 }}
    >
      {/* Тень под кубиком */}
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-black/30 blur-xl pointer-events-none"
        animate={rolling ? { width: size * 0.7, height: 14, opacity: 0.5, scale: [1, 0.85, 1.15, 0.9, 1] } : { width: size * 0.55, height: 18, opacity: 0.6 }}
        transition={{ duration: 0.5, ease: "easeOut", repeat: rolling ? Infinity : 0 }}
        style={{ bottom: -20 }}
      />

      {/* Glow вокруг кубика при rolling */}
      <AnimatePresence>
        {rolling && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.1, 1] }}
            exit={{ opacity: 0, scale: 1 }}
            transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              boxShadow: `0 0 ${size * 0.3}px rgba(168,85,247,0.7)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* 3D-куб — вращается в 3D-пространстве */}
      <motion.div
        className="relative"
        style={{
          width: size,
          height: size,
          transformStyle: "preserve-3d",
        }}
        animate={
          rolling
            ? {
                // Быстрое 3D-вращение по всем 3 осям
                rotateX: [0, 180, 540, 900, 1260, 1620, 1800],
                rotateY: [0, 360, 720, 1080, 1440, 1620, 1800],
                rotateZ: [0, -90, 180, -270, 360, -180, 0],
                scale: [1, 0.95, 1.05, 0.98, 1.02, 0.99, 1],
                y: [0, -10, 0, -8, 0, -4, 0],
              }
            : {
                // После остановки — поворот к front-грани + финальный bounce
                rotateX: 0,
                rotateY: 0,
                rotateZ: 0,
                scale: [1.15, 0.95, 1.05, 1],
                y: [0, -12, 0],
              }
        }
        transition={
          rolling
            ? { duration: 1.5, ease: [0.4, 0, 0.6, 1], repeat: Infinity }
            : { duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }
        }
      >
        {/* 6 граней кубика */}
        {faces.map((face, idx) => {
          const Icon = ICONS[face.icon] ?? Dices
          const transform = faceTransforms[idx].transform
          // Front-грань — показываем method (если есть), иначе дефолтную
          const isFront = idx === 0
          const faceMethod = isFront && method ? method : face
          const gradient = `bg-gradient-to-br ${faceMethod.gradient}`

          return (
            <div
              key={idx}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl shadow-2xl"
              style={{
                transform,
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              {/* Бэкграунд грани */}
              <div className={`absolute inset-0 rounded-2xl ${gradient} ring-2 ring-white/40`} />
              {/* Внутренний блик */}
              <div className="absolute inset-2 rounded-xl bg-white/15 ring-1 ring-white/30" />
              {/* Верхний блик */}
              <div
                className="absolute inset-0 rounded-2xl opacity-50"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 50%, rgba(0,0,0,0.15) 100%)",
                }}
              />

              {/* Контент грани — иконка + локализованный label */}
              <div className="relative z-10 flex flex-col items-center gap-2 px-4 text-center">
                <Icon
                  className="text-white drop-shadow-lg"
                  style={{ width: size * 0.32, height: size * 0.32 }}
                  strokeWidth={2.4}
                />
                <span
                  className="font-extrabold uppercase tracking-wide text-white drop-shadow-md"
                  style={{ fontSize: size * 0.1 }}
                >
                  {getMethodLabel(faceMethod, lang)}
                </span>
              </div>

              {/* Точечки в углах — стилизация под кубик */}
              <div className="pointer-events-none absolute left-2.5 top-2.5 h-2 w-2 rounded-full bg-white/70" />
              <div className="pointer-events-none absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-white/70" />
              <div className="pointer-events-none absolute bottom-2.5 left-2.5 h-2 w-2 rounded-full bg-white/70" />
              <div className="pointer-events-none absolute bottom-2.5 right-2.5 h-2 w-2 rounded-full bg-white/70" />
            </div>
          )
        })}
      </motion.div>

      {/* Подпись «Бросок…» под кубиком во время броска */}
      <AnimatePresence>
        {rolling && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-1/2 top-full mt-4 -translate-x-1/2 text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400"
          >
            {ROLLING_LABEL[lang]}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
