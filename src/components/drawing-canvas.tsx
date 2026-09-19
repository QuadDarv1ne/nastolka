"use client"

import { useEffect, useRef, useState } from "react"
import { Eraser, Trash2, Brush } from "lucide-react"

/**
 * Простой холст для рисования пальцем или мышью.
 * Без сторонних библиотек — только canvas + touch/mouse events.
 * Подходит для способа Рисунком в Настолке.
 */

interface DrawingCanvasProps {
  /** Причина для очистки (например, ID слова) — холст очищается при изменении */
  resetKey?: string
}

const COLORS = [
  "#0f172a", // почти чёрный
  "#ef4444", // красный
  "#f59e0b", // оранжевый
  "#22c55e", // зелёный
  "#3b82f6", // синий
  "#a855f7", // фиолетовый
  "#ec4899", // розовый
  "#14b8a6", // бирюзовый
]

export function DrawingCanvas({ resetKey }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const [color, setColor] = useState<string>(COLORS[0])
  const [strokeWidth, setStrokeWidth] = useState<number>(4)
  const isDrawingRef = useRef<boolean>(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  // Инициализация контекста
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const setup = () => {
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      // Сохраняем текущий рисунок перед ресайзом (поворот экрана, смена размера окна)
      const prev = document.createElement("canvas")
      const hadContent = canvas.width > 0 && canvas.height > 0
      if (hadContent) {
        prev.width = canvas.width
        prev.height = canvas.height
        prev.getContext("2d")?.drawImage(canvas, 0, 0)
      }
      // Устанавливаем размер canvas с учётом DPR для чётких линий
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.strokeStyle = color
      ctx.lineWidth = strokeWidth
      // Восстанавливаем рисунок в новый размер
      if (hadContent && prev.width > 0) {
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.drawImage(prev, 0, 0, canvas.width, canvas.height)
        ctx.restore()
      }
      ctxRef.current = ctx
    }
    setup()
    // Поворот телефона / планшета, смена размера окна — перенастраиваем холст
    const observer = new ResizeObserver(() => setup())
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  // Очистка при смене resetKey
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.beginPath()
  }, [resetKey])

  // Обновление стиля кисти
  useEffect(() => {
    if (!ctxRef.current) return
    ctxRef.current.strokeStyle = color
    ctxRef.current.lineWidth = strokeWidth
  }, [color, strokeWidth])

  const getPos = (e: PointerEvent | React.PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e as PointerEvent).clientX - rect.left,
      y: (e as PointerEvent).clientY - rect.top,
    }
  }

  const startDrawing = (e: React.PointerEvent) => {
    e.preventDefault()
    const ctx = ctxRef.current
    if (!ctx) return
    isDrawingRef.current = true
    const pos = getPos(e)
    lastPointRef.current = pos
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    // Для одиночного тапа — рисуем точку
    ctx.fillStyle = color
    ctx.arc(pos.x, pos.y, strokeWidth / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  const draw = (e: React.PointerEvent) => {
    if (!isDrawingRef.current) return
    e.preventDefault()
    const ctx = ctxRef.current
    if (!ctx) return
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPointRef.current = pos
  }

  const stopDrawing = () => {
    isDrawingRef.current = false
    lastPointRef.current = null
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.beginPath()
  }

  return (
    <div className="w-full">
      {/* Палитра и кнопки */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={`h-9 w-9 rounded-full border-2 transition hover:scale-110 sm:h-8 sm:w-8 ${
              color === c ? "border-foreground scale-110" : "border-transparent"
            }`}
            style={{ backgroundColor: c }}
            aria-label={`Цвет ${c}`}
          />
        ))}
        <div className="mx-1 h-7 w-px bg-border" />
        <button
          type="button"
          onClick={() => setStrokeWidth(2)}
          className={`grid h-9 w-9 place-items-center rounded-full border-2 transition sm:h-8 sm:w-8 ${
            strokeWidth === 2 ? "border-foreground" : "border-transparent"
          }`}
          aria-label="Тонкая кисть"
        >
          <span className="block h-1.5 w-1.5 rounded-full bg-foreground" />
        </button>
        <button
          type="button"
          onClick={() => setStrokeWidth(4)}
          className={`grid h-9 w-9 place-items-center rounded-full border-2 transition sm:h-8 sm:w-8 ${
            strokeWidth === 4 ? "border-foreground" : "border-transparent"
          }`}
          aria-label="Средняя кисть"
        >
          <span className="block h-3 w-3 rounded-full bg-foreground" />
        </button>
        <button
          type="button"
          onClick={() => setStrokeWidth(8)}
          className={`grid h-9 w-9 place-items-center rounded-full border-2 transition sm:h-8 sm:w-8 ${
            strokeWidth === 8 ? "border-foreground" : "border-transparent"
          }`}
          aria-label="Толстая кисть"
        >
          <span className="block h-4 w-4 rounded-full bg-foreground" />
        </button>
        <div className="mx-1 h-7 w-px bg-border" />
        <button
          type="button"
          onClick={clearCanvas}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/20 sm:h-8"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Очистить
        </button>
      </div>

      {/* Сам холст */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white shadow-inner ring-2 ring-foreground/10">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          style={{ touchAction: "none" }}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          onPointerCancel={stopDrawing}
        />
        <div className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
          <Brush className="h-3 w-3" />
          рисуй пальцем
        </div>
      </div>
    </div>
  )
}
