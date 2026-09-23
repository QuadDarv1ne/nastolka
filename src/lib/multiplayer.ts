"use client"

// Клиент для подключения к multiplayer-серверу Настолки.
// Использует socket.io-client (динамический импорт, чтобы не падать на SSR).
//
// ВАЖНО: transport — polling + websocket. Polling идёт через обычный HTTP,
// что надёжно работает через любой прокси (Caddy, Amvera). Websocket
// подключается потом как upgrade, если провайдер поддерживает.

import type { State } from "@/lib/types"
import { readItem, writeItem, removeItem } from "@/lib/storage"
import { getNickname } from "@/lib/nickname"

/** Профиль участника: имя игрока + характеристики устройства */
export interface MemberProfile {
  /** Имя игрока (вводит сам; сохраняется в localStorage) */
  name: string
  /** Тип устройства: phone / tablet / desktop */
  deviceType: "phone" | "tablet" | "desktop" | "unknown"
  /** ОС: iOS / Android / Windows / macOS … */
  os: string
  /** Браузер: Safari / Chrome … */
  browser: string
  /** Модель устройства (iPhone / iPad / ПК), если определилась */
  model: string
  /** Язык интерфейса браузера */
  lang: string
  /**
   * Стабильный ID устройства (хранится в localStorage). Сервер по нему
   * узнаёт устройство при переподключении и возвращает ему прежнюю команду.
   */
  deviceId: string
}

/** Ключ localStorage с именем игрока */
const MP_NAME_STORAGE_KEY = "nastolka-mp-name-v1"

/** Ключ localStorage со стабильным ID устройства */
const DEVICE_ID_STORAGE_KEY = "nastolka-device-id-v1"

/** Прочитать сохранённое имя игрока */
export function getPlayerName(): string {
  if (typeof window === "undefined") return ""
  return (readItem(MP_NAME_STORAGE_KEY) || "").trim()
}

/** Сохранить имя игрока */
export function setPlayerName(name: string) {
  if (typeof window === "undefined") return
  writeItem(MP_NAME_STORAGE_KEY, name.trim())
}

/**
 * Стабильный ID устройства. Генерируется один раз и живёт в localStorage,
 * поэтому переживает перезагрузку страницы и переподключение к комнате.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return ""
  let id = (readItem(DEVICE_ID_STORAGE_KEY) || "").trim()
  if (!id) {
    id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    writeItem(DEVICE_ID_STORAGE_KEY, id)
  }
  return id
}

/** Определить характеристики устройства из navigator/userAgent */
export function detectDeviceInfo(): Omit<MemberProfile, "name" | "deviceId"> {
  if (typeof window === "undefined") {
    return { deviceType: "unknown", os: "unknown", browser: "unknown", model: "unknown", lang: "ru" }
  }
  const ua = navigator.userAgent || ""
  const lang = (navigator.language || "ru").split("-")[0]

  const isTablet = /ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))
  const isPhone = /iphone|ipod|android.*mobile|windows phone|mobile/i.test(ua)
  const deviceType: MemberProfile["deviceType"] = isTablet
    ? "tablet"
    : isPhone
      ? "phone"
      : /windows|macintosh|linux|cros/i.test(ua)
        ? "desktop"
        : "unknown"

  const os = /windows phone/i.test(ua)
    ? "Windows Phone"
    : /windows/i.test(ua)
      ? "Windows"
      : /iphone|ipad|ipod/i.test(ua)
        ? "iOS"
        : /android/i.test(ua)
          ? "Android"
          : /mac os x|macintosh/i.test(ua)
            ? "macOS"
            : /cros/i.test(ua)
              ? "ChromeOS"
              : /linux/i.test(ua)
                ? "Linux"
                : "unknown"

  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /opr\//i.test(ua)
      ? "Opera"
      : /samsungbrowser/i.test(ua)
        ? "Samsung Internet"
        : /firefox\/|fxios/i.test(ua)
          ? "Firefox"
          : /chrome\/|crios/i.test(ua)
            ? "Chrome"
            : /safari\//i.test(ua)
              ? "Safari"
              : "unknown"

  // Модель: iPhone/iPad выцепляем из UA; Android-модель — сегмент перед скобкой
  let model = "unknown"
  if (/iPhone/i.test(ua)) model = "iPhone"
  else if (/iPad/i.test(ua)) model = "iPad"
  else if (/iPod/i.test(ua)) model = "iPod"
  else if (deviceType === "desktop") model = os === "unknown" ? "ПК" : os
  else {
    // Android: "Android 14; K; Pixel 8" — модель обычно последним сегментом
    const androidPart = ua.slice(ua.indexOf("Android"), ua.indexOf(")") > 0 ? ua.indexOf(")") : ua.length)
    const segments = androidPart.split(";").map((s) => s.trim()).slice(1)
    // Отбрасываем локали (ru-RU) и маркеры сборки (K, wv)
    const candidates = segments.filter((p) => p && !/^[a-z]{2}-[a-z]{2}$/i.test(p) && !/^(k|wv)$/i.test(p))
    model = candidates[candidates.length - 1] || "Android"
  }

  return { deviceType, os, browser, model, lang }
}

/** Собрать полный профиль участника (глобальный никнейм + устройство) */
export function buildMemberProfile(): MemberProfile {
  // Глобальный никнейм обязателен при заходе на сайт; если вдруг пуст — fallback
  const name = getNickname() || getPlayerName()
  const info = detectDeviceInfo()
  return {
    name: name || `${info.model} · ${info.os}`,
    deviceId: getDeviceId(),
    ...info,
  }
}

export interface MultiplayerClient {
  disconnect: () => void
  sendState: (state: State) => void
  requestState: () => void
  sendStateTo: (to: string, state: State) => void
  /** Отправить метаданные (инфа о командах для списка лобби) */
  sendMeta: (meta: MultiplayerMeta) => void
  /** Запросить список открытых лобби у сервера */
  listLobbies: () => void
  /** Явно покинуть комнату (сервер удаляет устройство сразу, без грейс-периода) */
  leaveRoom: () => void
  /** Мой socketId */
  socketId: string
  /** Стабильный ID моего устройства (по нему сервер узнаёт нас при переподключении) */
  deviceId: string
  on: <K extends keyof MultiplayerEvents>(event: K, cb: (payload: MultiplayerEvents[K]) => void) => void
  off: <K extends keyof MultiplayerEvents>(event: K, cb: (payload: MultiplayerEvents[K]) => void) => void
}

/** Метаданные клиента: инфа о командах для списка лобби */
export interface MultiplayerMeta {
  /** Инфа о командах (имена/эмодзи) — для отображения в списке лобби */
  teams?: { name: string; emoji: string }[]
  [key: string]: unknown
}

/** Публичное описание лобби в списке */
export interface LobbyInfo {
  code: string
  members: number
  max: number
  syncMode: "host" | "sync"
  teams: { name: string; emoji: string }[]
  status: "lobby" | "playing"
  createdAt: number
  /** Участники комнаты (имена + устройства) */
  players: { teamIndex: number; profile: MemberProfile; connected?: boolean }[]
}

export interface MultiplayerEvents {
  'room-created': { code: string; teamIndex: number; syncMode: "host" | "sync"; members: number }
  'room-joined': { code: string; members: number; teamIndex: number; syncMode: "host" | "sync"; reconnected?: boolean }
  'room-error': { message: string }
  /** Ответ на явный выход из комнаты */
  'room-left': { code: string }
  'peer-joined': { id: string; members: number; teamIndex: number; profile: MemberProfile }
  'peer-left': { id: string; members: number; teamIndex: number }
  /** Полный список участников комнаты с профилями (после входа/выхода/переименования) */
  'members-list': { members: RoomMember[] }
  'state-update': { from: string; state: State }
  'state-requested': { from: string }
  'pong-test': { time: number }
  'meta-update': { from: string; meta: MultiplayerMeta }
  /** Сервер назначил участнику команду */
  'team-assigned': { memberId: string; teamIndex: number; members: number }
  /** Полное лобби (4/4): команды перемешаны, каждому — его новая команда */
  'team-reassigned': { teamIndex: number; members: number }
  /** Полное лобби (4/4): все новые назначения (для отображения у всех) */
  'team-reassigned-all': { assignments: { id: string; teamIndex: number }[]; members: number }
  /** Ответ на list-lobbies */
  'lobbies-list': { lobbies: LobbyInfo[] }
  /** Список лобби изменился (создана/закрыта комната, вошёл/вышел игрок) */
  'lobbies-changed': { lobbies: LobbyInfo[] }
  /** Связь с сервером потеряна (сервер упал, Wi-Fi отвалился, ушли из комнаты) */
  'server-disconnect': { reason: string }
  /** Ошибка повторного подключения после обрыва */
  'reconnect-error': { message: string }
}

/** Участник комнаты: профиль + назначенная команда */
export interface RoomMember {
  id: string
  teamIndex: number
  profile: MemberProfile
  /** Есть ли живое соединение (false — устройство в грейс-периоде) */
  connected?: boolean
}

const CONNECT_TIMEOUT_MS = 15000  // больше времени на handshake через прокси

/** Опции socket.io: ManagerOptions (path, query, transports...) + SocketOptions (auth...) */
type IoOptions = Partial<
  import('socket.io-client').ManagerOptions & import('socket.io-client').SocketOptions
>

/**
 * Создать комнату. Возвращает клиент с кодом комнаты, назначенной командой
 * (хост всегда — команда 0) и syncMode комнаты (его задаёт хост).
 */
export async function createRoom(syncMode: "host" | "sync" = "host"): Promise<MultiplayerClient & { code: string; teamIndex: number }> {
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
    const start = () => socket.emit('create-room', { syncMode, profile: buildMemberProfile() })
    if (socket.connected) start()
    else socket.on('connect', start)
    socket.on('room-created', (payload: { code: string; teamIndex: number; syncMode: "host" | "sync" }) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      const wrapper: MultiplayerClient & { code: string; teamIndex: number; syncMode: "host" | "sync" } = {
        code: payload.code,
        teamIndex: payload.teamIndex ?? 0,
        syncMode: payload.syncMode ?? syncMode,
        ...makeWrapper(socket),
      }
      resolve(wrapper)
    })
  })
}

/** Присоединиться к комнате по коду. teamIndex/syncMode приходит от сервера. */
export async function joinRoom(code: string): Promise<MultiplayerClient & { teamIndex: number; syncMode: "host" | "sync"; reconnected: boolean }> {
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
      socket.emit('join-room', { code, profile: buildMemberProfile() })
    })
    socket.on('room-joined', (payload: { code: string; members: number; teamIndex: number; syncMode: "host" | "sync"; reconnected?: boolean }) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      const client = makeWrapper(socket)
      resolve(Object.assign(client, { teamIndex: payload.teamIndex, syncMode: payload.syncMode, code: payload.code, reconnected: !!payload.reconnected }))
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

/**
 * Одноразовый запрос списка открытых лобби: подключаемся, спрашиваем,
 * получаем ответ, отключаемся. Используется в окне «Лобби онлайн».
 */
export async function listLobbiesOnce(timeoutMs = 8000): Promise<LobbyInfo[]> {
  const socket = await connect()
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout)
      try { socket.disconnect() } catch {}
    }
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Сервер не ответил со списком лобби за 8 сек.'))
    }, timeoutMs)
    socket.once('lobbies-list', ({ lobbies }: { lobbies: LobbyInfo[] }) => {
      clearTimeout(timeout)
      cleanup()
      resolve(lobbies ?? [])
    })
    socket.emit('list-lobbies', {})
  })
}

/**
 * Живая подписка на список открытых лобби.
 *
 * Подключается, сразу запрашивает список (list-lobbies → lobbies-list) и далее
 * слушает серверные рассылки lobbies-changed, которые приходят при создании/
 * закрытии комнаты, входе/выходе игрока или смене статуса. Это заменяет
 * периодический поллинг и обновляет список мгновенно.
 *
 * Возвращает объект с stop() для отписки и закрытия сокета.
 */
export async function watchLobbies(
  onUpdate: (lobbies: LobbyInfo[]) => void,
  onError?: (err: Error) => void,
): Promise<{ stop: () => void; refresh: () => void }> {
  const socket = await connect()
  const handle = (payload: { lobbies?: LobbyInfo[] }) => onUpdate(payload?.lobbies ?? [])
  socket.on('lobbies-list', handle)
  socket.on('lobbies-changed', handle)
  socket.on('connect_error', (err: Error) => onError?.(err))
  const refresh = () => socket.emit('list-lobbies', {})
  refresh()
  return {
    stop: () => {
      try {
        socket.off('lobbies-list', handle)
        socket.off('lobbies-changed', handle)
        socket.disconnect()
      } catch {
        // ignore
      }
    },
    refresh,
  }
}

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
    listLobbies: () => socket.emit('list-lobbies', {}),
    leaveRoom: () => socket.emit('leave-room', {}),
    socketId: socket.id ?? '',
    deviceId: getDeviceId(),
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
