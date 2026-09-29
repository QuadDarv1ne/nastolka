"use client"
import type { State } from "@/lib/types"

export interface MultiplayerClient {
  disconnect: () => void
  sendState: (state: State, version?: number) => void
  requestState: () => void
  sendStateTo: (to: string, state: State) => void
  requestSnapshot: () => void
  sendMeta: (meta: MultiplayerMeta) => void
  sendChat: (text: string) => void
  requestChatHistory: () => void
  clearChat: () => void
  toggleChatReaction: (messageId: string, emoji: string) => void
  sendChatTyping: () => void
  sendChatStopTyping: () => void
  sendHeartbeat: () => void
  sendRttPing: () => number
  on: <K extends keyof MultiplayerEvents>(event: K, cb: (payload: MultiplayerEvents[K]) => void) => void
  off: <K extends keyof MultiplayerEvents>(event: K, cb?: (payload: MultiplayerEvents[K]) => void) => void
}

export interface MultiplayerMeta { role: "host" | "guest"; syncMode: "host" | "sync"; clientId: string }

export interface ChatMessage {
  id: string
  socketId: string
  deviceId: string
  playerName: string
  text: string
  timestamp: number
  /** Реакции: emoji → список deviceId, кто поставил */
  reactions?: Record<string, string[]>
}

export interface MultiplayerEvents {
  "room-created": { code: string }
  "room-joined": { code: string; members: number }
  "room-error": { message: string }
  "peer-joined": { id: string; members: number }
  "peer-left": { id: string; members: number }
  "state-update": { from: string; state: State; version?: number }
  "state-requested": { from: string }
  "pong-test": { time: number }
  "meta-update": { from: string; meta: MultiplayerMeta }
  "disconnect": { reason: string }
  "connect_error": { message: string }
  "reconnect": Record<string, never>
  "reconnect_attempt": { attempt: number }
  "reconnect_failed": Record<string, never>
  "reconnect_error": { message: string }
  "lobby-list-update": { lobbies: LobbyInfo[] }
  "team-assigned": { teamIdx: number; deviceId: string }
  "room-devices": RoomDevicesPayload
  "chat-message": ChatMessage
  "chat-history": { messages: ChatMessage[] }
  "chat-cleared": Record<string, never>
  "chat-message-updated": ChatMessage
  "chat-typing": { playerName: string; deviceId: string }
  "chat-stop-typing": { deviceId: string }
  "peer-away": { deviceId: string; away: boolean; lastSeen: number }
  "state-stale": { version: number; state: unknown }
  "state-snapshot": { state: unknown; version: number; owner?: string }
  "rtt-pong": { clientTime: number; serverTime: number; id: number }
}

export interface DeviceInfoOut {
  deviceId: string; deviceType: string; os: string; browser: string
  screenResolution: string; language: string; playerName: string
  teamIdx: number; socketId: string; userAgent?: string
  /** Persistent analytics ID (localStorage) — для отслеживания сессий */
  visitorId?: string
  /** Canvas-fingerprint hash (8 hex) */
  canvasFingerprint?: string
  /** GPU vendor from WebGL */
  gpuVendor?: string
  /** GPU renderer from WebGL */
  gpuRenderer?: string
  /** WebGL params hash (8 hex) */
  webglFingerprint?: string
  /** IP-префикс (первые 3 октета) — для приватности */
  ipPrefix?: string
  /** Статус: 'active' | 'away' */
  status?: 'active' | 'away'
  /** Timestamp последнего heartbeat */
  lastSeen?: number
}

export interface RoomDevicesPayload {
  devices: DeviceInfoOut[]
  members: number
  /** Серверная версия состояния */
  stateVersion?: number
}

export interface LobbyInfo {
  code: string
  members: number
  maxMembers: number
  hostName: string
  teamCount: number
  targetScore: number
}

const CONNECT_TIMEOUT_MS = 15000

/** Опции socket.io с авто-реконнектом (экспоненциальный backoff) */
const RECONNECT_OPTS = {
  path: "/",
  transports: ["polling", "websocket"] as ("polling" | "websocket")[],
  reconnection: true,
  reconnectionAttempts: 6,        // максимум 6 попыток
  reconnectionDelay: 1000,        // первая попытка через 1 сек
  reconnectionDelayMax: 30000,    // максимум 30 сек между попытками
  randomizationFactor: 0.5,       // 50% jitter для предотвращения thundering herd
  timeout: 10000,
  forceNew: true,
}

export async function createRoom(syncMode: "host" | "sync" = "host", options?: { open?: boolean; hostName?: string; teamCount?: number; targetScore?: number; device?: Partial<DeviceInfoOut> }): Promise<MultiplayerClient & { code: string }> {
  const socket = await connect()
  return new Promise((resolve, reject) => {
    let settled = false
    let connectedOnce = false
    const fail = (err: Error) => { if (settled) return; settled = true; try { socket.disconnect() } catch {}; reject(err) }
    const timeout = setTimeout(() => fail(new Error("Timeout")), CONNECT_TIMEOUT_MS)
    // connect_error только фейлит промис ДО первого успешного connect —
    // потом это уже reconnection attempt, обрабатывается через on("disconnect")
    socket.on("connect_error", (err: Error) => {
      if (!settled && !connectedOnce) fail(new Error(err.message))
    })
    socket.on("connect", () => {
      connectedOnce = true
      socket.emit("create-room", {
        open: options?.open ?? false,
        hostName: options?.hostName || "???",
        teamCount: options?.teamCount || 2,
        targetScore: options?.targetScore || 10,
        device: options?.device,
      })
    })
    socket.on("room-created", ({ code }: { code: string }) => {
      if (settled) return; settled = true; clearTimeout(timeout)
      const wrapper: MultiplayerClient & { code: string } = { code, ...makeWrapper(socket) }
      setActiveRoomCode(code)
      wrapper.sendMeta({ role: "host", syncMode, clientId: socket.id ?? "" })
      resolve(wrapper)
    })
    // Отлов обрыва связи после успешного подключения — пробрасывается подписчикам
    socket.on("disconnect", () => {
      // Подписчики client.on("disconnect") получат событие от socket.io автоматически
    })
  })
}

export async function joinRoom(code: string, syncMode: "host" | "sync" = "sync", device?: Partial<DeviceInfoOut>): Promise<MultiplayerClient> {
  const socket = await connect()
  return new Promise((resolve, reject) => {
    let settled = false
    let connectedOnce = false
    const fail = (err: Error) => { if (settled) return; settled = true; try { socket.disconnect() } catch {}; reject(err) }
    const timeout = setTimeout(() => fail(new Error("Timeout")), CONNECT_TIMEOUT_MS)
    socket.on("connect_error", (err: Error) => {
      if (!settled && !connectedOnce) fail(new Error(err.message))
    })
    socket.on("connect", () => {
      connectedOnce = true
      socket.emit("join-room", { code: code.trim().toUpperCase(), device })
    })
    socket.on("room-joined", (payload: { code: string; members: number }) => {
      if (settled) return; settled = true; clearTimeout(timeout)
      const client = makeWrapper(socket)
      setActiveRoomCode(payload.code)
      client.sendMeta({ role: "guest", syncMode, clientId: socket.id ?? "" })
      resolve(client)
    })
    socket.on("room-error", (err: { message: string }) => fail(new Error(err.message)))
    // Отлов обрыва связи после успешного подключения
    socket.on("disconnect", () => {
      // Подписчики client.on("disconnect") получат событие от socket.io автоматически
    })
  })
}

async function connect() {
  const { io } = await import("socket.io-client")
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"

  // Стратегия подключения:
  // 1. localhost / 127.0.0.1 → http://localhost:3003 (локальная разработка)
  // 2. IP-адрес в LAN (192.168.x.x, 10.x.x.x и т.п.) → http://[тот-же-IP]:3003 (WiFi-мультиплеер)
  // 3. Превью-домен (space-z.ai, amvera) → через Caddy с XTransformPort
  try {
    const urlObj = new URL(origin)
    const hostname = urlObj.hostname

    // localhost — локальная разработка
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") {
      return io("http://localhost:3003", RECONNECT_OPTS)
    }

    // LAN IP — WiFi-мультиплеер (телефон → компьютер в одной сети)
    // 192.168.x.x, 10.x.x.x, 172.16-31.x.x — частные IP-адреса
    const isLanIp = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(hostname)
    if (isLanIp) {
      return io(`http://${hostname}:3003`, RECONNECT_OPTS)
    }

    // Превью/прод — через Caddy прокси с XTransformPort
    return io("/", { ...RECONNECT_OPTS, query: { XTransformPort: "3003" } })
  } catch {
    // Fallback — пробуем через Caddy
    return io("/", { ...RECONNECT_OPTS, query: { XTransformPort: "3003" } })
  }
}

/** Хранит код активной комнаты для отображения в UI */
let activeRoomCode: string | null = null
export function getActiveRoomCode(): string | null { return activeRoomCode }
export function setActiveRoomCode(code: string | null): void { activeRoomCode = code }

function makeWrapper(socket: import("socket.io-client").Socket): MultiplayerClient {
  return {
    disconnect: () => { try { socket.disconnect() } catch {} ; setActiveRoomCode(null) },
    sendState: (state, version) => socket.emit("state-update", { state, version }),
    requestState: () => socket.emit("request-state", {}),
    sendStateTo: (to, state) => socket.emit("send-state-to", { to, state }),
    requestSnapshot: () => socket.emit("request-snapshot", {}),
    sendMeta: (meta) => socket.emit("meta-update", { meta }),
    sendChat: (text) => socket.emit("chat-message", { text }),
    requestChatHistory: () => socket.emit("chat-history-request", {}),
    clearChat: () => socket.emit("chat-clear", {}),
    toggleChatReaction: (messageId, emoji) => socket.emit("chat-toggle-reaction", { messageId, emoji }),
    sendChatTyping: () => socket.emit("chat-typing", {}),
    sendChatStopTyping: () => socket.emit("chat-stop-typing", {}),
    sendHeartbeat: () => socket.emit("heartbeat", {}),
    sendRttPing: () => {
      const id = Math.floor(Math.random() * 0xffffffff)
      socket.emit("rtt-ping", { clientTime: Date.now(), id })
      return id
    },
    on: (event, cb) => socket.on(event, cb as never),
    off: (event, cb) => socket.off(event, cb as never),
  }
}

/**
 * Подписка на список открытых лобби.
 * Возвращает функцию для отписки + обработчик обновлений списка.
 * Используется в MultiplayerDialog для показа доступных комнат.
 */
export async function watchLobbies(
  onUpdate: (lobbies: LobbyInfo[]) => void
): Promise<{
  stop: () => void
}> {
  const socket = await connect()
  socket.emit("watch-lobbies")
  socket.on("lobby-list-update", (payload: { lobbies: LobbyInfo[] }) => {
    onUpdate(payload.lobbies)
  })
  return {
    stop: () => {
      socket.emit("unwatch-lobbies")
      try { socket.disconnect() } catch {}
    },
  }
}
