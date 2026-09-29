"use client"
import { useEffect, useRef, useState } from "react"
import { Eraser, Trash2, Brush } from "lucide-react"

interface DrawingCanvasProps { resetKey?: string }

const COLORS = ["#0f172a", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"]

export function DrawingCanvas({ resetKey }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const [color, setColor] = useState(COLORS[0])
  const [strokeWidth, setStrokeWidth] = useState(4)
  const isDrawingRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr
    const ctx = canvas.getContext("2d"); if (!ctx) return
    ctx.scale(dpr, dpr); ctx.lineCap = "round"; ctx.lineJoin = "round"
    ctx.strokeStyle = color; ctx.lineWidth = strokeWidth
    ctxRef.current = ctx
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current; const ctx = ctxRef.current
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.beginPath()
  }, [resetKey])

  useEffect(() => {
    if (!ctxRef.current) return
    ctxRef.current.strokeStyle = color; ctxRef.current.lineWidth = strokeWidth
  }, [color, strokeWidth])

  const getPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current; if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDrawing = (e: React.PointerEvent) => {
    e.preventDefault(); const ctx = ctxRef.current; if (!ctx) return
    isDrawingRef.current = true; const pos = getPos(e)
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
    ctx.fillStyle = color; ctx.arc(pos.x, pos.y, strokeWidth / 2, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
  }

  const draw = (e: React.PointerEvent) => {
    if (!isDrawingRef.current) return; e.preventDefault()
    const ctx = ctxRef.current; if (!ctx) return
    const pos = getPos(e); ctx.lineTo(pos.x, pos.y); ctx.stroke()
  }

  const stopDrawing = () => { isDrawingRef.current = false }

  const clearCanvas = () => {
    const canvas = canvasRef.current; const ctx = ctxRef.current
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.beginPath()
  }

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {COLORS.map((c) => (
          <button key={c} type="button" onClick={() => setColor(c)}
            className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
            style={{ backgroundColor: c }} aria-label={c} />
        ))}
        <div className="mx-1 h-6 w-px bg-border" />
        {[2, 4, 8].map((w) => (
          <button key={w} type="button" onClick={() => setStrokeWidth(w)}
            className={`grid h-7 w-7 place-items-center rounded-full border-2 transition ${strokeWidth === w ? "border-foreground" : "border-transparent"}`}>
            <span className="block rounded-full bg-foreground" style={{ width: w, height: w }} />
          </button>
        ))}
        <div className="mx-1 h-6 w-px bg-border" />
        <button type="button" onClick={clearCanvas}
          className="inline-flex h-7 items-center gap-1.5 rounded-full bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/20">
          <Trash2 className="h-3.5 w-3.5" /> Очистить
        </button>
      </div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white shadow-inner ring-2 ring-foreground/10">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none"
          style={{ touchAction: "none" }}
          onPointerDown={startDrawing} onPointerMove={draw}
          onPointerUp={stopDrawing} onPointerLeave={stopDrawing} onPointerCancel={stopDrawing} />
        <div className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
          <Brush className="h-3 w-3" /> рисуй пальцем
        </div>
      </div>
    </div>
  )
}
