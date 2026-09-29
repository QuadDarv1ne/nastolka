// WebSocket сервер для синхронизации состояния игры "Настолка" между устройствами.
// v61: Device Registry — каждое устройство = отдельная команда (автоприсвоение).
import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ═══════════════ Структуры данных ═══════════════

interface DeviceInfo {
  /** Уникальный ID устройства (генерируется клиентом, хранится в localStorage) */
  deviceId: string
  /** Тип устройства: phone, tablet, laptop, desktop */
  deviceType: string
  /** ОС */
  os: string
  /** Браузер */
  browser: string
  /** Разрешение экрана */
  screenResolution: string
  /** User-Agent */
  userAgent: string
  /** Язык */
  language: string
  /** Имя, которое ввёл пользователь (опционально) */
  playerName?: string
  /** socket.id текущего подключения */
  socketId: string
  /** Время подключения */
  connectedAt: number
  /** IP-адрес клиента (от socket.handshake.headers) — для диагностики/логов */
  ip?: string
  /** X-Forwarded-For (если за прокси) */
  forwardedFor?: string
  /** Persistent visitor ID (localStorage, для аналитики) */
  visitorId?: string
  /** Canvas-fingerprint hash */
  canvasFingerprint?: string
  /** GPU vendor */
  gpuVendor?: string
  /** GPU renderer */
  gpuRenderer?: string
  /** WebGL params hash */
  webglFingerprint?: string
  /** Время последнего heartbeat-ответа (для проверки активности) */
  lastSeen?: number
}

interface RoomInfo {
  code: string
  members: Set<string>
  /** Маппинг socketId → DeviceInfo */
  devices: Map<string, DeviceInfo>
  /** Маппинг deviceId → teamIdx (какое устройство за какую команду) */
  teamAssignments: Map<string, number>
  hostName?: string
  teamCount?: number
  targetScore?: number
  isOpen?: boolean
  createdAt: number
  /** История чата комнаты (до 100 последних сообщений) */
  chatHistory: ChatMessage[]
  /** Монотонная версия состояния игры — для разрешения конфликтов */
  stateVersion: number
  /** Последнее валидное состояние игры (для отдачи новым участникам) */
  lastState?: unknown
  /** socketId того, кто владеет состоянием (хост или активный игрок) */
  stateOwner?: string
}

interface ChatMessage {
  id: string
  socketId: string
  deviceId: string
  playerName: string
  text: string
  timestamp: number
  /** Реакции: emoji → список deviceId, кто поставил */
  reactions?: Record<string, string[]>
}

const MAX_CHAT_HISTORY = 100

/** Допустимые emoji для реакций (защита от спама) */
const ALLOWED_REACTIONS = new Set(["👍", "❤️", "😂", "🔥", "😮", "🎉"])

const rooms = new Map<string, RoomInfo>()
const socketToRoom = new Map<string, string>()
const lobbyWatchers = new Set<string>()

/** Извлекает реальный IP клиента из socket.handshake.headers */
function getClientIp(socket: { handshake: { headers: Record<string, string | string[] | undefined> } }): { ip: string; forwardedFor?: string } {
  const headers = socket.handshake.headers
  // X-Forwarded-For — стандартный заголовок через прокси/CDN
  const xff = headers['x-forwarded-for']
  const forwardedFor = Array.isArray(xff) ? xff[0] : xff
  // X-Real-IP — nginx/Caddy
  const xRealIp = headers['x-real-ip'] as string | undefined
  // CF-Connecting-IP — Cloudflare
  const cfIp = headers['cf-connecting-ip'] as string | undefined
  // Приоритет: CF > X-Real-IP > первый IP из X-Forwarded-For > socket.address
  const ip = cfIp || xRealIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : '') || 'unknown'
  return { ip, forwardedFor }
}

/** Обогащает DeviceInfo IP-адресом и fingerprint из входящих данных */
function enrichDeviceInfo(socket: { handshake: { headers: Record<string, string | string[] | undefined> } }, deviceInfo: DeviceInfo, data?: Partial<DeviceInfo>): DeviceInfo {
  const { ip, forwardedFor } = getClientIp(socket)
  return {
    ...deviceInfo,
    ip,
    forwardedFor,
    visitorId: data?.visitorId,
    canvasFingerprint: data?.canvasFingerprint,
    gpuVendor: data?.gpuVendor,
    gpuRenderer: data?.gpuRenderer,
    webglFingerprint: data?.webglFingerprint,
    lastSeen: Date.now(),
  }
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const generateRoomCode = () => {
  let code = ''
  for (let i = 0; i < 4; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return rooms.has(code) ? generateRoomCode() : code
}

// ═══════════════ Broadcast списка лобби ═══════════════

function getOpenLobbies() {
  const list: Array<{
    code: string; members: number; maxMembers: number
    hostName: string; teamCount: number; targetScore: number
    devices: Array<{ deviceId: string; deviceType: string; playerName: string }>
  }> = []
  for (const [code, room] of rooms) {
    if (room.isOpen && room.members.size > 0) {
      const devices: Array<{ deviceId: string; deviceType: string; playerName: string }> = []
      for (const [, info] of room.devices) {
        devices.push({ deviceId: info.deviceId, deviceType: info.deviceType, playerName: info.playerName || '???' })
      }
      list.push({
        code, members: room.members.size, maxMembers: 4,
        hostName: room.hostName || '???', teamCount: room.teamCount || 2,
        targetScore: room.targetScore || 10, devices,
      })
    }
  }
  return list.sort((a, b) => b.members - a.members)
}

function broadcastLobbyList() {
  const list = getOpenLobbies()
  for (const socketId of lobbyWatchers) {
    io.to(socketId).emit('lobby-list-update', { lobbies: list })
  }
}

// ═══════════════ Авто-присвоение команды устройству ═══════════════

function assignTeamToDevice(room: RoomInfo, deviceId: string): number {
  // Если уже назначен — возвращаем
  const existing = room.teamAssignments.get(deviceId)
  if (existing !== undefined) return existing

  // Находим первую свободную команду
  const assigned = new Set(room.teamAssignments.values())
  const maxTeams = room.teamCount || 2
  for (let i = 0; i < maxTeams; i++) {
    if (!assigned.has(i)) {
      room.teamAssignments.set(deviceId, i)
      return i
    }
  }
  // Все заняты — spectator (-1)
  return -1
}

// ═══════════════ Broadcast devices + team assignments в комнату ═══════════════

function broadcastRoomInfo(roomCode: string) {
  const room = rooms.get(roomCode)
  if (!room) return
  const devices: Array<{
    deviceId: string; deviceType: string; os: string; browser: string
    screenResolution: string; language: string; playerName: string
    teamIdx: number; socketId: string
    /** IP-префикс (первые 3 октета) для отладки — без последнего октета для приватности */
    ipPrefix?: string
    /** Текущий статус: 'active' | 'away' */
    status?: 'active' | 'away'
    /** Timestamp последней активности */
    lastSeen?: number
    /** Canvas fingerprint (для идентификации устройства) */
    canvasFingerprint?: string
    /** GPU vendor (краткая инфа об устройстве) */
    gpuVendor?: string
  }> = []
  for (const [socketId, info] of room.devices) {
    const teamIdx = room.teamAssignments.get(info.deviceId) ?? -1
    // Прячем последний октет IP для приватности: "192.168.1.x"
    let ipPrefix: string | undefined
    if (info.ip && info.ip !== 'unknown') {
      const parts = info.ip.split('.')
      if (parts.length === 4) ipPrefix = `${parts[0]}.${parts[1]}.${parts[2]}.x`
      else ipPrefix = info.ip // IPv6 или unusual — отдаём как есть
    }
    // Статус: away если lastSeen устарел
    const now = Date.now()
    const status: 'active' | 'away' = info.lastSeen && (now - info.lastSeen > 90000) ? 'away' : 'active'
    devices.push({
      deviceId: info.deviceId, deviceType: info.deviceType, os: info.os,
      browser: info.browser, screenResolution: info.screenResolution,
      language: info.language, playerName: info.playerName || '???',
      teamIdx, socketId,
      ipPrefix,
      status,
      lastSeen: info.lastSeen,
      canvasFingerprint: info.canvasFingerprint,
      gpuVendor: info.gpuVendor,
    })
  }
  io.to(roomCode).emit('room-devices', { devices, members: room.members.size, stateVersion: room.stateVersion })
}

// ═══════════════ Обработка подключений ═══════════════

io.on('connection', (socket) => {
  // ── Создать комнату с device info ──
  socket.on('create-room', (data: {
    open?: boolean; hostName?: string; teamCount?: number; targetScore?: number
    device?: Partial<DeviceInfo>
  }) => {
    const code = generateRoomCode()
    const baseInfo: DeviceInfo = {
      deviceId: data.device?.deviceId || `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      deviceType: data.device?.deviceType || 'unknown',
      os: data.device?.os || 'unknown',
      browser: data.device?.browser || 'unknown',
      screenResolution: data.device?.screenResolution || 'unknown',
      userAgent: data.device?.userAgent || '',
      language: data.device?.language || 'unknown',
      playerName: data.device?.playerName || data.hostName || '???',
      socketId: socket.id,
      connectedAt: Date.now(),
    }
    const deviceInfo = enrichDeviceInfo(socket, baseInfo, data.device)

    rooms.set(code, {
      code,
      members: new Set([socket.id]),
      devices: new Map([[socket.id, deviceInfo]]),
      teamAssignments: new Map([[deviceInfo.deviceId, 0]]), // Хост = команда 0
      hostName: data?.hostName || deviceInfo.playerName,
      teamCount: data?.teamCount || 2,
      targetScore: data?.targetScore || 10,
      isOpen: data?.open ?? false,
      createdAt: Date.now(),
      chatHistory: [],
      stateVersion: 0,
    })
    socketToRoom.set(socket.id, code)
    socket.join(code)

    // Отправляем хосту: код комнаты + team assignment + список устройств
    socket.emit('room-created', { code })
    socket.emit('team-assigned', { teamIdx: 0, deviceId: deviceInfo.deviceId })
    broadcastRoomInfo(code)

    if (data?.open) broadcastLobbyList()
  })

  // ── Подписаться на список открытых лобби ──
  socket.on('watch-lobbies', () => {
    lobbyWatchers.add(socket.id)
    socket.emit('lobby-list-update', { lobbies: getOpenLobbies() })
  })

  socket.on('unwatch-lobbies', () => { lobbyWatchers.delete(socket.id) })

  // ── Присоединиться к комнате с device info ──
  socket.on('join-room', (data: { code: string; device?: Partial<DeviceInfo> }) => {
    const upper = (data.code || '').toUpperCase().trim()
    const room = rooms.get(upper)
    if (!room) { socket.emit('room-error', { message: 'Room not found' }); return }
    if (room.members.size >= 4) { socket.emit('room-error', { message: 'Room full' }); return }

    const baseInfo: DeviceInfo = {
      deviceId: data.device?.deviceId || `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      deviceType: data.device?.deviceType || 'unknown',
      os: data.device?.os || 'unknown',
      browser: data.device?.browser || 'unknown',
      screenResolution: data.device?.screenResolution || 'unknown',
      userAgent: data.device?.userAgent || '',
      language: data.device?.language || 'unknown',
      playerName: data.device?.playerName || '???',
      socketId: socket.id,
      connectedAt: Date.now(),
    }
    const deviceInfo = enrichDeviceInfo(socket, baseInfo, data.device)

    room.members.add(socket.id)
    room.devices.set(socket.id, deviceInfo)
    socketToRoom.set(socket.id, upper)
    socket.join(upper)

    // ── Авто-присвоение команды ──
    const teamIdx = assignTeamToDevice(room, deviceInfo.deviceId)

    // Отправляем гостю: код комнаты + team assignment + список устройств
    socket.emit('room-joined', { code: upper, members: room.members.size })
    socket.emit('team-assigned', { teamIdx, deviceId: deviceInfo.deviceId })

    // Уведомляем остальных о новом устройстве
    socket.to(upper).emit('peer-joined', { id: socket.id, members: room.members.size })
    broadcastRoomInfo(upper)
    broadcastLobbyList()
  })

  // ── Обновить имя игрока ──
  socket.on('update-player-name', (data: { playerName: string }) => {
    const roomCode = socketToRoom.get(socket.id)
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    const info = room.devices.get(socket.id)
    if (info) {
      info.playerName = data.playerName.slice(0, 20)
      broadcastRoomInfo(roomCode)
    }
  })

  // ── Чат: отправить сообщение ──
  socket.on('chat-message', (data: { text: string }) => {
    const roomCode = socketToRoom.get(socket.id)
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    const info = room.devices.get(socket.id)
    if (!info) return
    const text = (data.text || '').trim().slice(0, 500)
    if (!text) return
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      socketId: socket.id,
      deviceId: info.deviceId,
      playerName: info.playerName || '???',
      text,
      timestamp: Date.now(),
    }
    room.chatHistory.push(message)
    if (room.chatHistory.length > MAX_CHAT_HISTORY) {
      room.chatHistory = room.chatHistory.slice(-MAX_CHAT_HISTORY)
    }
    // Broadcast всем в комнате (включая отправителя — для подтверждения)
    io.to(roomCode).emit('chat-message', message)
  })

  // ── Чат: запросить историю при входе ──
  socket.on('chat-history-request', () => {
    const roomCode = socketToRoom.get(socket.id)
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    socket.emit('chat-history', { messages: room.chatHistory })
  })

  // ── Чат: очистить историю (только хост) ──
  socket.on('chat-clear', () => {
    const roomCode = socketToRoom.get(socket.id)
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    const isFirst = room.members.values().next().value === socket.id
    if (!isFirst) return
    room.chatHistory = []
    io.to(roomCode).emit('chat-cleared', {})
  })

  // ── Чат: поставить/снять реакцию на сообщение ──
  socket.on('chat-toggle-reaction', (data: { messageId: string; emoji: string }) => {
    const roomCode = socketToRoom.get(socket.id)
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    const info = room.devices.get(socket.id)
    if (!info) return
    const emoji = (data.emoji || '').trim()
    if (!ALLOWED_REACTIONS.has(emoji)) return
    // Найти сообщение в истории
    const msg = room.chatHistory.find((m) => m.id === data.messageId)
    if (!msg) return
    // Инициализировать реакции
    if (!msg.reactions) msg.reactions = {}
    if (!msg.reactions[emoji]) msg.reactions[emoji] = []
    // Toggle: если уже ставил — снять, иначе — поставить
    const idx = msg.reactions[emoji].indexOf(info.deviceId)
    if (idx >= 0) {
      msg.reactions[emoji].splice(idx, 1)
      if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji]
    } else {
      msg.reactions[emoji].push(info.deviceId)
    }
    // Broadcast обновлённое сообщение
    io.to(roomCode).emit('chat-message-updated', msg)
  })

  // ── Чат: индикатор «печатает…» ──
  socket.on('chat-typing', () => {
    const roomCode = socketToRoom.get(socket.id)
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    const info = room.devices.get(socket.id)
    if (!info) return
    // Broadcast другим (не себе) — playerName
    socket.to(roomCode).emit('chat-typing', { playerName: info.playerName || '???', deviceId: info.deviceId })
  })

  // ── Чат: остановка печати ──
  socket.on('chat-stop-typing', () => {
    const roomCode = socketToRoom.get(socket.id)
    if (!roomCode) return
    socket.to(roomCode).emit('chat-stop-typing', { deviceId: socket.id })
  })

  // ── Синхронизация состояния игры (с версионированием) ──
  socket.on('state-update', ({ state, version }: { state: unknown; version?: number }) => {
    const room = socketToRoom.get(socket.id)
    if (!room) return
    const room2 = rooms.get(room)
    if (!room2) return
    // Атомарное обновление версии: увеличиваем только если клиент прислал
    // version === room2.stateVersion (или не прислал вовсе — для обратной совместимости)
    if (version === undefined || version === room2.stateVersion) {
      room2.stateVersion++
      room2.lastState = state
      room2.stateOwner = socket.id
      // Broadcast с актуальной версией — клиент может её использовать для оптимистичных обновлений
      socket.to(room).emit('state-update', { from: socket.id, state, version: room2.stateVersion })
    } else {
      // Устаревшая версия — отклоняем, отправляем клиенту текущее состояние
      socket.emit('state-stale', { version: room2.stateVersion, state: room2.lastState })
    }
  })

  // ── Запросить актуальное состояние (с версией) ──
  socket.on('request-state', () => {
    const room = socketToRoom.get(socket.id)
    if (!room) return
    socket.to(room).emit('state-requested', { from: socket.id })
  })

  // ── Запросить полный snapshot комнаты (для новоподключившихся) ──
  socket.on('request-snapshot', () => {
    const roomCode = socketToRoom.get(socket.id)
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    // Если у комнаты есть lastState — отправляем его новому участнику
    if (room.lastState !== undefined) {
      socket.emit('state-snapshot', {
        state: room.lastState,
        version: room.stateVersion,
        owner: room.stateOwner,
      })
    }
  })

  socket.on('send-state-to', ({ to, state }: { to: string; state: unknown }) => {
    io.to(to).emit('state-update', { from: socket.id, state })
  })

  socket.on('meta-update', ({ meta }: { meta: unknown }) => {
    const room = socketToRoom.get(socket.id)
    if (room) socket.to(room).emit('meta-update', { from: socket.id, meta })
  })

  socket.on('update-room-meta', (data: { teamCount?: number; targetScore?: number; open?: boolean }) => {
    const roomCode = socketToRoom.get(socket.id)
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    const isFirst = room.members.values().next().value === socket.id
    if (!isFirst) return
    if (data.teamCount !== undefined) room.teamCount = data.teamCount
    if (data.targetScore !== undefined) room.targetScore = data.targetScore
    if (data.open !== undefined) room.isOpen = data.open
    broadcastLobbyList()
  })

  socket.on('ping-test', () => {
    // Обновляем lastSeen при пинге
    const roomCode = socketToRoom.get(socket.id)
    if (roomCode) {
      const room = rooms.get(roomCode)
      const info = room?.devices.get(socket.id)
      if (info) info.lastSeen = Date.now()
    }
    socket.emit('pong-test', { time: Date.now(), clientTime: Date.now() })
  })

  // ── RTT-измерение: клиент присылает timestamp, сервер возвращает + свое время ──
  socket.on('rtt-ping', (data: { clientTime: number; id: number }) => {
    const roomCode = socketToRoom.get(socket.id)
    if (roomCode) {
      const room = rooms.get(roomCode)
      const info = room?.devices.get(socket.id)
      if (info) info.lastSeen = Date.now()
    }
    socket.emit('rtt-pong', { clientTime: data.clientTime, serverTime: Date.now(), id: data.id })
  })

  // ── Heartbeat от клиента: обновляем lastSeen ──
  socket.on('heartbeat', () => {
    const roomCode = socketToRoom.get(socket.id)
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    const info = room.devices.get(socket.id)
    if (info) info.lastSeen = Date.now()
  })

  // ── Отключение ──
  socket.on('disconnect', () => {
    const roomCode = socketToRoom.get(socket.id)
    if (roomCode) {
      const room = rooms.get(roomCode)
      if (room) {
        room.members.delete(socket.id)
        room.devices.delete(socket.id)
        if (room.members.size === 0) {
          rooms.delete(roomCode)
        } else {
          socket.to(roomCode).emit('peer-left', { id: socket.id, members: room.members.size })
          broadcastRoomInfo(roomCode)
        }
      }
      broadcastLobbyList()
    }
    lobbyWatchers.delete(socket.id)
    socketToRoom.delete(socket.id)
  })
})

// ═══════════════ Периодическая проверка lastSeen ═══════════════
// Если сокет не отзывался более 90 сек — помечаем как офлайн и оповещаем комнату.
// Socket.IO сам делает ping/pong (pingInterval: 25s, pingTimeout: 60s),
// но lastSeen — для бизнес-логики "пользователь активен" (для чата, готовности и т.д.)
const HEARTBEAT_TIMEOUT_MS = 90000
setInterval(() => {
  const now = Date.now()
  for (const [code, room] of rooms) {
    for (const [socketId, info] of room.devices) {
      // Если lastSeen устарел — оповещаем других об "away"
      if (info.lastSeen && now - info.lastSeen > HEARTBEAT_TIMEOUT_MS) {
        // Отправляем уведомление только если сокет ещё в members
        if (room.members.has(socketId)) {
          io.to(code).emit('peer-away', { deviceId: info.deviceId, away: true, lastSeen: info.lastSeen })
        }
      }
    }
  }
}, 30000) // Проверка каждые 30 сек

httpServer.listen(3003, '0.0.0.0', () => {
  console.log('Nastolka WebSocket server on port 3003 (0.0.0.0) — v80 State Versioning + RTT')
})

process.on('SIGTERM', () => httpServer.close(() => process.exit(0)))
process.on('SIGINT', () => httpServer.close(() => process.exit(0)))
