"use client"

// Клиент для подключения к multiplayer-серверу «Настолки».
// Использует socket.io-client (динамический импорт, чтобы не падать на SSR).
//
// ВАЖНО: transport — polling + websocket. Polling идёт через обычный HTTP,
// что надёжно работает через любой прокси (Caddy, Amvera). Websocket
// подключается потом как upgrade, если провайдер поддерживает.

import type { State } from "@/app/page"

export interface MultiplayerClient {
  disconnect: () => void
  sendState: (state: State) => void
  requestState: () => void
  sendStateTo: (to: string, state: State) => void
  /** Отправить метаданные (роль, режим, ID) */
  sendMeta: (meta: MultiplayerMeta) => void
  on: <K extends keyof MultiplayerEvents>(event: K, cb: (payload: MultiplayerEvents[K]) => void) => void
  off: <K extends keyof MultiplayerEvents>(event: K, cb: (payload: MultiplayerEvents[K]) => void) => void
}

/** Метаданные клиента: роль и режим синхронизации */
export interface MultiplayerMeta {
  role: "host" | "guest"
  syncMode: "host" | "sync"
  clientId: string
}

export interface MultiplayerEvents {
  'room-created': { code: string }
  'room-joined': { code: string; members: number }
  'room-error': { message: string }
  'peer-joined': { id: string; members: number }
  'peer-left': { id: string; members: number }
  'state-update': { from: string; state: State }
  'state-requested': { from: string }
  'pong-test': { time: number }
  'meta-update': { from: string; meta: MultiplayerMeta }
}

const CONNECT_TIMEOUT_MS = 15000  // больше времени на handshake через прокси

/** Создать комнату. Возвращает клиент с кодом комнаты. */
export async function createRoom(syncMode: "host" | "sync" = "host"): Promise<MultiplayerClient & { code: string }> {
  const socket = await connect()
  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (err: Error) => {
      if (settled) return
      settled = true
      try { socket.disconnect() } catch {}
      reject(err)
    }
    const timeout = setTimeout(() => fail(new Error('Сервер не ответил за 15 сек. Проверьте, что мини-сервис запущен на порту 3003.')), CONNECT_TIMEOUT_MS)
    socket.on('connect_error', (err: Error) => fail(new Error(`Ошибка подключения: ${err.message}`)))
    socket.on('connect', () => {
      // Подключились — теперь ждём room-created
      socket.emit('create-room', {})
    })
    socket.on('room-created', ({ code }: { code: string }) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      const wrapper: MultiplayerClient & { code: string } = {
        code,
        ...makeWrapper(socket),
      }
      // Отправляем другим участникам метаданные о себе (роль = host, режим)
      wrapper.sendMeta({ role: "host", syncMode, clientId: socket.id })
      resolve(wrapper)
    })
  })
}

/** Присоединиться к комнате по коду */
export async function joinRoom(code: string, syncMode: "host" | "sync" = "sync"): Promise<MultiplayerClient> {
  const socket = await connect()
  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (err: Error) => {
      if (settled) return
      settled = true
      try { socket.disconnect() } catch {}
      reject(err)
    }
    const timeout = setTimeout(() => fail(new Error('Сервер не ответил за 15 сек. Проверьте, что мини-сервис запущен на порту 3003.')), CONNECT_TIMEOUT_MS)
    socket.on('connect_error', (err: Error) => fail(new Error(`Ошибка подключения: ${err.message}`)))
    socket.on('connect', () => {
      socket.emit('join-room', { code })
    })
    socket.on('room-joined', (payload: { code: string; members: number }) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      const client = makeWrapper(socket)
      // Отправляем метаданные (роль = guest, режим)
      client.sendMeta({ role: "guest", syncMode, clientId: socket.id })
      resolve(client)
    })
    socket.on('room-error', (err: { message: string }) => {
      fail(new Error(err.message))
    })
  })
}

async function connect() {
  // Динамический импорт — socket.io-client только в браузере
  const { io } = await import('socket.io-client')

  // Стратегия подключения:
  // 1. Пробуем через Caddy-прокси с XTransformPort (работает на Amvera и в превью)
  // 2. Если не получилось — пробуем напрямую к порту 3003 (для локальной разработки)
  // Используем polling как основной transport — он надёжнее через прокси.

  // Определяем origin: на локалхосте — localhost:3000, в превью — preview-*.space-z.ai
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  const isLocal = origin.includes("localhost") || origin.includes("127.0.0.1")

  // Для локальной разработки — можем ходить напрямую на 3003 (CORS уже *)
  // Для превью/прод — только через Caddy с XTransformPort
  const url = isLocal ? "http://localhost:3003" : "/"
  const opts: import('socket.io-client').SocketOptions = isLocal
    ? { path: '/', transports: ['polling', 'websocket'], reconnection: false, timeout: 10000, forceNew: true }
    : { path: '/', transports: ['polling', 'websocket'], reconnection: false, timeout: 10000, forceNew: true, query: { XTransformPort: '3003' } }

  return io(url, opts)
}

function makeWrapper(socket: import('socket.io-client').Socket): MultiplayerClient {
  return {
    disconnect: () => socket.disconnect(),
    sendState: (state) => socket.emit('state-update', { state }),
    requestState: () => socket.emit('request-state', {}),
    sendStateTo: (to, state) => socket.emit('send-state-to', { to, state }),
    sendMeta: (meta) => socket.emit('meta-update', { meta }),
    on: (event, cb) => socket.on(event, cb as never),
    off: (event, cb) => socket.off(event, cb as never),
  }
}
