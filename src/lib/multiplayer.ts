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

/** Опции socket.io: ManagerOptions (path, query, transports...) + SocketOptions (auth...) */
type IoOptions = Partial<
  import('socket.io-client').ManagerOptions & import('socket.io-client').SocketOptions
>

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
    // connect() уже дожидается подключения, но на случай reconnect — обрабатываем оба варианта
    const start = () => socket.emit('create-room', {})
    if (socket.connected) start()
    else socket.on('connect', start)
    socket.on('room-created', ({ code }: { code: string }) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      const wrapper: MultiplayerClient & { code: string } = {
        code,
        ...makeWrapper(socket),
      }
      // Отправляем другим участникам метаданные о себе (роль = host, режим)
      wrapper.sendMeta({ role: "host", syncMode, clientId: socket.id ?? '' })
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
      client.sendMeta({ role: "guest", syncMode, clientId: socket.id ?? '' })
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

  // Стратегия подключения (кандидаты пробуются по очереди, пока один не подключится):
  // 1. localhost        → напрямую http://localhost:3003
  // 2. превью/прод      → через прокси с XTransformPort (Caddy, Amvera)
  // 3. тот же хост в LAN (телефон по Wi-Fi, например http://192.168.1.5:3000)
  //                    → напрямую http://<hostname>:3003

  const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost"
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1"

  const baseOpts: IoOptions = {
    path: '/',
    transports: ['polling', 'websocket'],
    reconnection: false,
    timeout: 7000,
    forceNew: true,
  }

  const candidates: Array<{ label: string; url: string; opts: IoOptions }> =
    isLocal
      ? [{ label: 'localhost:3003', url: 'http://localhost:3003', opts: baseOpts }]
      : [
          { label: 'прокси (XTransformPort)', url: '/', opts: { ...baseOpts, query: { XTransformPort: '3003' } } },
          { label: `напрямую ${hostname}:3003`, url: `http://${hostname}:3003`, opts: baseOpts },
        ]

  let lastError: Error | null = null
  for (const c of candidates) {
    try {
      return await tryConnect(io, c.url, c.opts)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw new Error(
    `Не удалось подключиться (пробовали: ${candidates.map((c) => c.label).join(', ')}). ` +
      'Проверьте, что мини-сервер мультиплеера запущен (порт 3003), и что оба устройства в одной сети.'
  )
}

/** Подключиться к одному URL; резолвится после события 'connect' */
function tryConnect(
  io: typeof import('socket.io-client')['io'],
  url: string,
  opts: import('socket.io-client').SocketOptions
): Promise<import('socket.io-client').Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(url, opts)
    const timeout = setTimeout(() => {
      try { socket.disconnect() } catch {}
      reject(new Error(`Таймаут подключения к ${url}`))
    }, 8000)
    socket.on('connect', () => {
      clearTimeout(timeout)
      resolve(socket)
    })
    socket.on('connect_error', (err: Error) => {
      clearTimeout(timeout)
      try { socket.disconnect() } catch {}
      reject(err)
    })
  })
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
