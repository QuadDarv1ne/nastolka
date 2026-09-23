"use client"

// Клиент для подключения к multiplayer-серверу Настолки.
// Использует socket.io-client (динамический импорт, чтобы не падать на SSR).
//
// ВАЖНО: transport — polling + websocket. Polling идёт через обычный HTTP,
// что надёжно работает через любой прокси (Caddy, Amvera). Websocket
// подключается потом как upgrade, если провайдер поддерживает.

import type { State } from "@/lib/types"
import { readItem, removeItem, writeItem } from "@/lib/storage"

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
  /** Связь с сервером потеряна (сервер упал, Wi-Fi отвалился, ушли из комнаты) */
  'server-disconnect': { reason: string }
  /** Ошибка повторного подключения после обрыва */
  'reconnect-error': { message: string }
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

/** Ключ localStorage с ручным адресом WS-сервера (для нестандартных сетей) */
const MP_URL_STORAGE_KEY = "nastolka-mp-url-v1"

/** Ручной адрес сервера мультиплеера, если пользователь задал его в настройках */
export function getManualMpUrl(): string {
  if (typeof window === "undefined") return ""
  return (readItem(MP_URL_STORAGE_KEY) || "").trim()
}

/** Сохранить/очистить ручной адрес сервера мультиплеера */
export function setManualMpUrl(url: string) {
  if (typeof window === "undefined") return
  const v = url.trim()
  if (v) writeItem(MP_URL_STORAGE_KEY, v)
  else removeItem(MP_URL_STORAGE_KEY)
}

/** Путь socket.io — должен совпадать с MP_PATH в mini-services/nastolka-multiplayer */
const WS_PATH = "/mp"

/** Кандидат на подключение: человекочитаемая подпись + url + опции сокета */
interface Candidate {
  label: string
  url: string
  opts: IoOptions
}

/** Собрать список адресов, которые стоит попробовать, в порядке приоритета. */
function buildCandidates(): Candidate[] {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost"
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1"

  const baseOpts: IoOptions = {
    path: WS_PATH,
    transports: ["polling", "websocket"],
    reconnection: false,
    timeout: 7000,
    forceNew: true,
  }

  const list: Candidate[] = []

  // 0. Ручной адрес из настроек — всегда самый приоритетный
  const manual = getManualMpUrl()
  if (manual) list.push({ label: `вручную (${manual})`, url: manual, opts: baseOpts })

  // 1. Тот же origin, что и у сайта: Next проксирует /mp/* на мини-сервис
  //    (см. rewrites в next.config.ts). Работает и на localhost, и по LAN-IP,
  //    и по HTTPS-домену — порт 3003 снаружи вообще не нужен.
  list.push({ label: "через сайт (/mp)", url: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000", opts: baseOpts })

  // 2. Напрямую на порт 3003 того же хоста — если прокси/rewrite недоступны
  //    (например, прод-сборка без rewrites или standalone-сервер).
  if (isLocal) {
    list.push({ label: "localhost:3003", url: "http://localhost:3003", opts: baseOpts })
  } else {
    list.push({
      label: `${hostname}:3003 напрямую`,
      url: `http://${hostname}:3003`,
      opts: baseOpts,
    })
    // 3. Провайдеры вида Amvera/Caddy, где порт выбирается query-параметром
    list.push({
      label: "прокси (XTransformPort)",
      url: "/",
      opts: { ...baseOpts, query: { XTransformPort: "3003" } },
    })
  }

  return list
}

async function connect() {
  // Динамический импорт — socket.io-client только в браузере
  const { io } = await import('socket.io-client')

  const candidates = buildCandidates()
  const errors: string[] = []

  for (const c of candidates) {
    try {
      return await tryConnect(io, c.url, c.opts)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${c.label}: ${msg}`)
      if (typeof console !== "undefined") console.warn("[multiplayer] кандидат не подошёл:", c.label, msg)
    }
  }

  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:"
  const hints: string[] = []
  if (isHttps) {
    hints.push("Сайт открыт по HTTPS — браузер не пустит незащищённое ws:// соединение. Запустите мини-сервис и заходите по http://IP:3000, либо укажите адрес сервера вручную в окне мультиплеера.")
  }
  hints.push("Проверьте, что мини-сервис запущен: bun run mp (порт 3003).")
  hints.push("Оба устройства должны быть в одной Wi-Fi сети.")

  throw new Error(
    `Не удалось подключиться. Пробовали: ${candidates.map((c) => c.label).join("; ")}. ` +
      errors.join(" | ") + " → " + hints.join(" ")
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
  // Локальные подписки на синтетические события (server-disconnect, reconnect-error).
  // События от сервера доставляет сам socket.io через socket.on.
  const localHandlers = new Map<keyof MultiplayerEvents, Set<(payload: never) => void>>()
  const emitLocal = <K extends keyof MultiplayerEvents>(event: K, payload: MultiplayerEvents[K]) => {
    localHandlers.get(event)?.forEach((cb) => (cb as (p: MultiplayerEvents[K]) => void)(payload))
  }
  const wrapper: MultiplayerClient = {
    disconnect: () => socket.disconnect(),
    sendState: (state) => socket.emit('state-update', { state }),
    requestState: () => socket.emit('request-state', {}),
    sendStateTo: (to, state) => socket.emit('send-state-to', { to, state }),
    sendMeta: (meta) => socket.emit('meta-update', { meta }),
    on: (event, cb) => {
      socket.on(event, cb as never)
      let set = localHandlers.get(event)
      if (!set) {
        set = new Set()
        localHandlers.set(event, set)
      }
      set.add(cb as (payload: never) => void)
    },
    off: (event, cb) => {
      socket.off(event, cb as never)
      localHandlers.get(event)?.delete(cb as (payload: never) => void)
    },
  }
  // Пробрасываем обрывы связи наружу: socket.io с reconnection:false
  // после разрыва уже не подключается сам — UI должен это показать.
  socket.on('disconnect', (reason: string) => {
    emitLocal('server-disconnect', { reason: reason || 'transport closed' })
  })
  socket.io.on('reconnect_error', (err: { message?: string }) => {
    emitLocal('reconnect-error', { message: err?.message || 'reconnect failed' })
  })
  return wrapper
}
