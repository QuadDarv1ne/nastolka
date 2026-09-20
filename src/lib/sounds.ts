// Звуковые эффекты через Web Audio API — без файлов, синтезируем на лету.
// Это снижает размер бандла и работает оффлайн.

let audioCtx: AudioContext | null = null
let muted = false

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (muted) return null
  if (!audioCtx) {
    try {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext
      audioCtx = new Ctor()
    } catch {
      return null
    }
  }
  // Некоторые браузеры запускают ctx в suspended-состоянии
  if (audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function setMuted(value: boolean) {
  muted = value
}

export function isMuted() {
  return muted
}

/** Разблокировать аудио-контекст после первого пользовательского жеста */
export function unlockAudio() {
  const ctx = getCtx()
  if (ctx && ctx.state === "suspended") {
    void ctx.resume().catch(() => {})
  }
}

interface ToneOptions {
  freq: number
  duration: number
  type?: OscillatorType
  volume?: number
  startAt?: number
  glideTo?: number
}

function playTone(ctx: AudioContext, opts: ToneOptions) {
  const { freq, duration, type = "sine", volume = 0.18, startAt = 0, glideTo } = opts
  const t0 = ctx.currentTime + startAt
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (glideTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + duration)
  }
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(volume, t0 + Math.min(0.02, duration / 3))
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

/* ────────────────────────────── Эффекты ────────────────────────────── */

/** Перекатывание кубика — короткие щелчки в течение durationMs */
export function playDiceRoll(durationMs = 1400) {
  const ctx = getCtx()
  if (!ctx) return
  const start = ctx.currentTime
  const ticks = Math.floor(durationMs / 110)
  for (let i = 0; i < ticks; i++) {
    const t = (i / ticks) * durationMs / 1000
    const freq = 180 + Math.random() * 220
    playTone(ctx, {
      freq,
      duration: 0.06,
      type: "triangle",
      volume: 0.12,
      startAt: t,
    })
  }
  // Финальный тук когда кубик остановился
  playTone(ctx, {
    freq: 90,
    duration: 0.18,
    type: "sine",
    volume: 0.28,
    startAt: durationMs / 1000 - 0.02,
  })
  void start
}

/** Тик таймера — короткий бип. Выше и тревожнее, если мало времени */
export function playTick(urgent: boolean) {
  const ctx = getCtx()
  if (!ctx) return
  playTone(ctx, {
    freq: urgent ? 1320 : 880,
    duration: urgent ? 0.09 : 0.06,
    type: "square",
    volume: urgent ? 0.16 : 0.09,
  })
}

/** Угадали — весёлый аккорд */
export function playCorrect() {
  const ctx = getCtx()
  if (!ctx) return
  playTone(ctx, { freq: 660, duration: 0.12, type: "triangle", volume: 0.2 })
  playTone(ctx, { freq: 880, duration: 0.12, type: "triangle", volume: 0.2, startAt: 0.08 })
  playTone(ctx, { freq: 1320, duration: 0.22, type: "triangle", volume: 0.2, startAt: 0.16 })
}

/** Пропуск — нейтральный низкий тон */
export function playSkip() {
  const ctx = getCtx()
  if (!ctx) return
  playTone(ctx, { freq: 320, duration: 0.16, type: "sawtooth", volume: 0.14, glideTo: 180 })
}

/** Время вышло — нисходящий грустный мотив */
export function playTimeUp() {
  const ctx = getCtx()
  if (!ctx) return
  playTone(ctx, { freq: 600, duration: 0.18, type: "sawtooth", volume: 0.16 })
  playTone(ctx, { freq: 500, duration: 0.18, type: "sawtooth", volume: 0.16, startAt: 0.18 })
  playTone(ctx, { freq: 380, duration: 0.3, type: "sawtooth", volume: 0.18, startAt: 0.36 })
}

/** Победа — фанфары */
export function playWin() {
  const ctx = getCtx()
  if (!ctx) return
  const notes = [
    { f: 523, t: 0.0 },
    { f: 659, t: 0.12 },
    { f: 784, t: 0.24 },
    { f: 1047, t: 0.36 },
    { f: 880, t: 0.48 },
    { f: 1047, t: 0.6 },
    { f: 1319, t: 0.72 },
  ]
  for (const n of notes) {
    playTone(ctx, { freq: n.f, duration: 0.22, type: "triangle", volume: 0.22, startAt: n.t })
  }
  // Финальный аккорд
  playTone(ctx, { freq: 1047, duration: 0.6, type: "triangle", volume: 0.18, startAt: 0.96 })
  playTone(ctx, { freq: 1319, duration: 0.6, type: "triangle", volume: 0.18, startAt: 0.96 })
  playTone(ctx, { freq: 1568, duration: 0.6, type: "triangle", volume: 0.18, startAt: 0.96 })
}

/** Замена слова — лёгкий свист */
export function playSwap() {
  const ctx = getCtx()
  if (!ctx) return
  playTone(ctx, { freq: 440, duration: 0.14, type: "sine", volume: 0.15, glideTo: 880 })
}

/** Активация фишки ×2 — волшебный аккорд (две октавы вверх) */
export function playChipX2() {
  const ctx = getCtx()
  if (!ctx) return
  playTone(ctx, { freq: 523, duration: 0.1, type: "triangle", volume: 0.2 })
  playTone(ctx, { freq: 659, duration: 0.1, type: "triangle", volume: 0.2, startAt: 0.05 })
  playTone(ctx, { freq: 1047, duration: 0.18, type: "triangle", volume: 0.22, startAt: 0.1 })
  playTone(ctx, { freq: 2093, duration: 0.22, type: "triangle", volume: 0.18, startAt: 0.18 })
}

/** Активация фишки +10 сек — нарастающий тон (время увеличивается) */
export function playChipPlus10() {
  const ctx = getCtx()
  if (!ctx) return
  playTone(ctx, { freq: 440, duration: 0.3, type: "triangle", volume: 0.18, glideTo: 880 })
  // Тики после нарастания
  for (let i = 0; i < 3; i++) {
    playTone(ctx, { freq: 1320, duration: 0.06, type: "square", volume: 0.1, startAt: 0.32 + i * 0.08 })
  }
}

/** Активация фишки +5 сек — короткий нарастающий тон */
export function playChipPlus5() {
  const ctx = getCtx()
  if (!ctx) return
  playTone(ctx, { freq: 440, duration: 0.18, type: "triangle", volume: 0.16, glideTo: 660 })
  for (let i = 0; i < 2; i++) {
    playTone(ctx, { freq: 1100, duration: 0.05, type: "square", volume: 0.08, startAt: 0.2 + i * 0.07 })
  }
}

/** Большой выигрыш (12+ очков за раунд) — тройной аккорд */
export function playBigScore() {
  const ctx = getCtx()
  if (!ctx) return
  playTone(ctx, { freq: 523, duration: 0.18, type: "triangle", volume: 0.22 })
  playTone(ctx, { freq: 659, duration: 0.18, type: "triangle", volume: 0.22, startAt: 0.1 })
  playTone(ctx, { freq: 784, duration: 0.18, type: "triangle", volume: 0.22, startAt: 0.2 })
  playTone(ctx, { freq: 1047, duration: 0.4, type: "triangle", volume: 0.24, startAt: 0.3 })
}

/* ─────────── Звуки игровой доски ─────────── */

/** Hop-звук для каждого шага фишки по доске (восходящая мелодия) */
export function playPieceHop(step: number, _total: number) {
  const ctx = getCtx()
  if (!ctx) return
  // Восходящая мелодия — чем дальше шаг, тем выше тон
  const notes = [523, 587, 659, 698, 784, 880, 988, 1047] // C5...C6
  const freq = notes[Math.min(step, notes.length - 1)]
  playTone(ctx, { freq, duration: 0.07, type: "triangle", volume: 0.14 })
}

/** Активация команды — мягкий звон «твой ход» */
export function playTeamActive() {
  const ctx = getCtx()
  if (!ctx) return
  playTone(ctx, { freq: 880, duration: 0.1, type: "sine", volume: 0.12 })
  playTone(ctx, { freq: 1320, duration: 0.15, type: "sine", volume: 0.12, startAt: 0.08 })
}

/** Звук провала (skipped) — нисходящий тон */
export function playSkippedBuzzer() {
  const ctx = getCtx()
  if (!ctx) return
  playTone(ctx, { freq: 380, duration: 0.16, type: "sawtooth", volume: 0.14, glideTo: 220 })
}

/** Звук достижения финиша фишкой (победный аккорд) */
export function playPieceFinish() {
  const ctx = getCtx()
  if (!ctx) return
  playTone(ctx, { freq: 523, duration: 0.15, type: "triangle", volume: 0.22 })
  playTone(ctx, { freq: 659, duration: 0.15, type: "triangle", volume: 0.22, startAt: 0.08 })
  playTone(ctx, { freq: 784, duration: 0.15, type: "triangle", volume: 0.22, startAt: 0.16 })
  playTone(ctx, { freq: 1047, duration: 0.5, type: "triangle", volume: 0.26, startAt: 0.24 })
}

/** Звук достижения вехи на доске (звон «бонус») */
export function playMilestone() {
  const ctx = getCtx()
  if (!ctx) return
  playTone(ctx, { freq: 880, duration: 0.12, type: "triangle", volume: 0.18 })
  playTone(ctx, { freq: 1175, duration: 0.18, type: "triangle", volume: 0.2, startAt: 0.06 })
}

/* ─────────── Тактильная отдача (Vibration API) ─────────── */

let hapticsEnabled = true

export function setHapticsEnabled(value: boolean) {
  hapticsEnabled = value
}

export function isHapticsEnabled() {
  return hapticsEnabled
}

function vibrate(pattern: number | number[]) {
  if (!hapticsEnabled) return
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return
  try {
    navigator.vibrate(pattern)
  } catch {
    // ignore
  }
}

export function hapticRoll() { vibrate([50, 30, 50, 30, 50]) }
export function hapticScore() { vibrate(100) }
export function hapticSkip() { vibrate([80, 40, 80]) }
export function hapticChip() { vibrate(60) }
export function hapticWin() { vibrate([100, 50, 100, 50, 200]) }
export function hapticTick() { vibrate(20) }
