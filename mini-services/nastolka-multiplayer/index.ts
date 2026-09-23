// WebSocket сервер для синхронизации состояния игры Настолка между устройствами.
// Запускается на порту 3003 (см. Caddyfile для проксирования через XTransformPort).
//
// Архитектура:
//   - Клиент создаёт комнату (syncMode задаёт ХОСТ) → код (4 символа)
//   - Второй клиент вводит код (или выбирает из списка лобби) → присоединяется
//   - Сервер назначает каждому участнику команду (teamIndex):
//       1-й → команда 0, 2-й → команда 1, 3-й → команда 2, 4-й → команда 3
//       при полном лобби (4/4) назначения перемешиваются (рандомизация)
//   - Активный игрок (владелец раунда) отправляет state-update с полем activeTeam;
//     сервер ретранслирует состояние всем остальным участникам комнаты
//   - Каждый клиент играет только раунды своей команды, чужие — смотрит
//
// Состояние игры не хранится на сервере — каждый клиент держит своё и отправляет
// обновления. Сервер — ретранслятор + реестр комнат/команд/лобби.

import { createServer } from 'http'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { Server, type Socket } from 'socket.io'

// Путь socket.io — /mp, а не корень. Это позволяет Next.js проксировать
// мультиплеер через rewrite /mp/* → :3003 (см. next.config.ts), чтобы у сайта
// и WebSocket был один origin. Иначе браузер блокирует http-сокет на
// https-странице (mixed content), а на превью-доменах порт 3003 вообще закрыт.
const WS_PATH = process.env.MP_PATH || '/mp'
const LOG_FILE = resolve(process.env.MP_LOG_FILE || 'logs/multiplayer.log')
const TRUST_PROXY = process.env.MP_TRUST_PROXY !== 'false'
const MAX_MEMBERS = 4

mkdirSync(dirname(LOG_FILE), { recursive: true })

const normalizeIp = (ip: string) => ip.startsWith('::ffff:') ? ip.slice(7) : ip

const getClientIp = (socket: Socket) => {
  const forwarded = socket.handshake.headers['x-forwarded-for']
  if (TRUST_PROXY && typeof forwarded === 'string' && forwarded.length > 0) {
    return normalizeIp(forwarded.split(',')[0].trim())
  }
  const realIp = socket.handshake.headers['x-real-ip']
  if (TRUST_PROXY && typeof realIp === 'string' && realIp.length > 0) {
    return normalizeIp(realIp.trim())
  }
  return normalizeIp(socket.handshake.address || 'unknown')
}

const writeLog = (event: string, details: Record<string, unknown>) => {
  try {
    appendFileSync(LOG_FILE, `${JSON.stringify({ timestamp: new Date().toISOString(), event, ...details })}\n`)
  } catch (error) {
    console.error('[log] не удалось записать multiplayer.log:', error)
  }
}

/** Профиль участника: имя игрока + характеристики устройства (от клиента) */
interface MemberProfile {
  name: string
  deviceType: string
  os: string
  browser: string
  model: string
  lang: string
}

/** Информация о комнате для реестра и списка лобби */
interface RoomInfo {
  code: string
  /** Режим синхронизации задаёт хост при создании комнаты */
  syncMode: 'host' | 'sync'
  /** socketId → teamIndex (какой командой играет участник) */
  teamAssignments: Map<string, number>
  /** socketId → профиль участника (имя + устройство) */
  memberInfo: Map<string, MemberProfile>
  /** Инфа о командах от хоста (имена/эмодзи) — для списка лобби */
  teamInfo: { name: string; emoji: string }[]
  /** Статус комнаты для списка лобби: лобби (setup) или в игре */
  status: 'lobby' | 'playing'
  createdAt: number
}

// roomCode → RoomInfo
const rooms = new Map<string, RoomInfo>()
// socketId → roomCode (для быстрого выхода)
const socketToRoom = new Map<string, string>()

/** Участник комнаты: профиль + команда (публичный вид без socketId) */
const roomMembers = (room: RoomInfo) =>
  Array.from(room.teamAssignments.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([id, teamIndex]) => ({
      id,
      teamIndex,
      profile: room.memberInfo.get(id) || { name: 'Игрок', deviceType: 'unknown', os: 'unknown', browser: 'unknown', model: 'unknown', lang: 'ru' },
    }))

/** Нормализовать профиль от клиента (защита от мусора) */
const normalizeProfile = (profile: unknown): MemberProfile => {
  const p = (profile || {}) as Partial<MemberProfile>
  const str = (v: unknown, fallback: string, max = 40) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback
  return {
    name: str(p.name, 'Игрок'),
    deviceType: str(p.deviceType, 'unknown', 10),
    os: str(p.os, 'unknown', 20),
    browser: str(p.browser, 'unknown', 20),
    model: str(p.model, 'unknown', 30),
    lang: str(p.lang, 'ru', 5),
  }
}

/** Публичное описание комнаты для списка лобби (без socketId) */
const lobbyView = (room: RoomInfo) => ({
  code: room.code,
  members: room.teamAssignments.size,
  max: MAX_MEMBERS,
  syncMode: room.syncMode,
  teams: room.teamInfo,
  status: room.status,
  createdAt: room.createdAt,
  /** Участники комнаты с профилями устройств (кто сидит в лобби) */
  players: roomMembers(room).map(({ teamIndex, profile }) => ({ teamIndex, profile })),
})

/** Список всех комнат для списка лобби */
const lobbiesList = () => Array.from(rooms.values()).map(lobbyView)

/** Сообщить всем подключённым, что список лобби изменился */
const broadcastLobbiesChanged = () => {
  io.emit('lobbies-changed', { lobbies: lobbiesList() })
}

const httpServer = createServer((req, res) => {
  // Health-check: `curl http://localhost:3003/health`
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', rooms: rooms.size, path: WS_PATH }))
    return
  }
  res.writeHead(404)
  res.end()
})

const io = new Server(httpServer, {
  path: WS_PATH,
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // без похожих символов
const generateRoomCode = () => {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return rooms.has(code) ? generateRoomCode() : code
}

/** Назначить следующий свободный teamIndex (по порядку входа) */
const nextTeamIndex = (room: RoomInfo) => {
  const used = new Set(room.teamAssignments.values())
  for (let i = 0; i < MAX_MEMBERS; i++) {
    if (!used.has(i)) return i
  }
  return 0
}

/**
 * Перемешать назначения команд при полном лобби (4/4) —
 * кто какой командой играет, определяется случайно.
 * Возвращает новые назначения socketId → teamIndex.
 */
const shuffleAssignments = (room: RoomInfo) => {
  const ids = Array.from(room.teamAssignments.keys())
  const indexes = ids.map((id) => room.teamAssignments.get(id)!)
  // Тасование Фишера—Йетса
  for (let i = indexes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indexes[i], indexes[j]] = [indexes[j], indexes[i]]
  }
  const assignments = ids.map((id, i) => ({ id, teamIndex: indexes[i] }))
  for (const { id, teamIndex } of assignments) room.teamAssignments.set(id, teamIndex)
  return assignments
}

const leaveRoom = (socketId: string, notify = true) => {
  const roomCode = socketToRoom.get(socketId)
  if (!roomCode) return
  const room = rooms.get(roomCode)
  io.sockets.sockets.get(socketId)?.leave(roomCode)
  if (room) {
    // Какой командой играл выходящий — чтобы клиенты могли завершить игру
    const teamIndex = room.teamAssignments.get(socketId) ?? -1
    room.teamAssignments.delete(socketId)
    room.memberInfo.delete(socketId)
    if (room.teamAssignments.size === 0) {
      rooms.delete(roomCode)
      console.log(`[room ${roomCode}] emptied, removed`)
      broadcastLobbiesChanged()
    } else if (notify) {
      io.to(roomCode).emit('peer-left', { id: socketId, members: room.teamAssignments.size, teamIndex })
      io.to(roomCode).emit('members-list', { members: roomMembers(room) })
      console.log(`[room ${roomCode}] ${socketId} left (team ${teamIndex}, now ${room.teamAssignments.size})`)
      broadcastLobbiesChanged()
    }
  }
  socketToRoom.delete(socketId)
}

io.on('connection', (socket) => {
  const ip = getClientIp(socket)
  console.log(`[+] ${socket.id} (${ip})`)
  writeLog('connect', { socketId: socket.id, ip })

  // Список открытых лобби (для экрана «Лобби онлайн»)
  socket.on('list-lobbies', () => {
    socket.emit('lobbies-list', { lobbies: lobbiesList() })
  })

  // Создать новую комнату (syncMode задаёт хост)
  socket.on('create-room', ({ syncMode, profile }: { syncMode?: 'host' | 'sync'; profile?: unknown }) => {
    leaveRoom(socket.id)
    const code = generateRoomCode()
    const room: RoomInfo = {
      code,
      syncMode: syncMode === 'sync' ? 'sync' : 'host',
      teamAssignments: new Map([[socket.id, 0]]), // хост — команда 0
      memberInfo: new Map([[socket.id, normalizeProfile(profile)]]),
      teamInfo: [],
      status: 'lobby',
      createdAt: Date.now(),
    }
    rooms.set(code, room)
    socketToRoom.set(socket.id, code)
    socket.join(code)
    socket.emit('room-created', { code, teamIndex: 0, syncMode: room.syncMode, members: 1 })
    socket.emit('members-list', { members: roomMembers(room) })
    console.log(`[room ${code}] created by ${socket.id} (syncMode=${room.syncMode})`)
    writeLog('room-created', { socketId: socket.id, ip, room: code })
    broadcastLobbiesChanged()
  })

  // Обновить свой профиль (переименование игрока)
  socket.on('update-profile', ({ profile }: { profile?: unknown }) => {
    const roomCode = socketToRoom.get(socket.id)
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    room.memberInfo.set(socket.id, normalizeProfile(profile))
    io.to(roomCode).emit('members-list', { members: roomMembers(room) })
    broadcastLobbiesChanged()
  })

  // Присоединиться к существующей комнате
  socket.on('join-room', ({ code, profile }: { code: string; profile?: unknown }) => {
    const upper = (code || '').toUpperCase().trim()
    const room = rooms.get(upper)
    if (!room) {
      socket.emit('room-error', { message: 'Комната не найдена' })
      return
    }
    if (room.teamAssignments.size >= MAX_MEMBERS) {
      socket.emit('room-error', { message: 'Комната уже заполнена (макс 4 игрока)' })
      return
    }
    leaveRoom(socket.id)
    const teamIndex = nextTeamIndex(room)
    room.teamAssignments.set(socket.id, teamIndex)
    room.memberInfo.set(socket.id, normalizeProfile(profile))
    socketToRoom.set(socket.id, upper)
    socket.join(upper)
    const members = room.teamAssignments.size
    // syncMode комнаты задаёт ХОСТ — гость получает его от сервера,
    // а не выбирает сам (иначе режимы расходятся и состояния воюют).
    socket.emit('room-joined', { code: upper, members, teamIndex, syncMode: room.syncMode })
    // Сообщить остальным, что присоединился новый участник и какой командой он играет
    socket.to(upper).emit('peer-joined', {
      id: socket.id,
      members,
      teamIndex,
      profile: room.memberInfo.get(socket.id)!,
    })
    io.to(upper).emit('members-list', { members: roomMembers(room) })
    io.to(upper).emit('team-assigned', { memberId: socket.id, teamIndex, members })
    // При полном лобби (4/4) — рандомизируем распределение команд
    if (members === MAX_MEMBERS) {
      const assignments = shuffleAssignments(room)
      for (const { id, teamIndex: newIndex } of assignments) {
        io.to(id).emit('team-reassigned', { teamIndex: newIndex, members })
      }
      io.to(upper).emit('team-reassigned-all', {
        assignments: assignments.map(({ id, teamIndex: newIndex }) => ({ id, teamIndex: newIndex })),
        members,
      })
      console.log(`[room ${upper}] full (${members}/4) — команды перемешаны`)
    }
    console.log(`[room ${upper}] ${socket.id} joined (team ${teamIndex}, now ${members})`)
    writeLog('room-joined', { socketId: socket.id, ip, room: upper, teamIndex })
    broadcastLobbiesChanged()
  })

  // Синхронизация состояния игры
  socket.on('state-update', ({ state }: { state: unknown }) => {
    const roomCode = socketToRoom.get(socket.id)
    if (!roomCode) return
    // Ретранслируем всем остальным в комнате (не себе)
    socket.to(roomCode).emit('state-update', { from: socket.id, state })
    // Обновляем статус комнаты для списка лобби
    const room = rooms.get(roomCode)
    if (room) {
      const phase = (state as { phase?: string } | null)?.phase
      const status = phase === 'setup' ? 'lobby' : 'playing'
      if (status !== room.status) {
        room.status = status
        broadcastLobbiesChanged()
      }
    }
  })

  // Запрос текущего состояния у участников (новый участник просит)
  socket.on('request-state', () => {
    const roomCode = socketToRoom.get(socket.id)
    if (!roomCode) return
    socket.to(roomCode).emit('state-requested', { from: socket.id })
  })

  // Ответить другому участнику состоянием (один из участников отвечает)
  socket.on('send-state-to', ({ to, state }: { to: string; state: unknown }) => {
    const roomCode = socketToRoom.get(socket.id)
    if (!roomCode || socketToRoom.get(to) !== roomCode) return
    io.to(to).emit('state-update', { from: socket.id, state })
  })

  // Метаданные от хоста: инфа о командах (имена/эмодзи) для списка лобби
  socket.on('meta-update', ({ meta }: { meta: unknown }) => {
    const roomCode = socketToRoom.get(socket.id)
    if (!roomCode) return
    const room = rooms.get(roomCode)
    if (!room) return
    // teamInfo обновляет только создатель комнаты (первый участник)
    const hostId = Array.from(room.teamAssignments.keys())[0]
    if (socket.id === hostId && meta && typeof meta === 'object' && 'teams' in meta && Array.isArray((meta as { teams: unknown }).teams)) {
      room.teamInfo = (meta as { teams: { name: string; emoji: string }[] }).teams.slice(0, MAX_MEMBERS)
      broadcastLobbiesChanged()
    }
    socket.to(roomCode).emit('meta-update', { from: socket.id, meta })
  })

  // Поиск пары: ping для проверки соединения
  socket.on('ping-test', () => {
    socket.emit('pong-test', { time: Date.now() })
  })

  socket.on('disconnect', () => {
    const roomCode = socketToRoom.get(socket.id)
    leaveRoom(socket.id)
    writeLog('disconnect', { socketId: socket.id, ip, room: roomCode || null })
    console.log(`[-] ${socket.id} (${ip})`)
  })

  socket.on('error', (err) => {
    console.error(`Socket error (${socket.id}):`, err)
  })
})

// Порт можно переопределить переменной окружения MP_PORT (по умолчанию 3003)
const PORT = Number(process.env.MP_PORT) || 3003
httpServer.listen(PORT, () => {
  console.log(`Nastolka WebSocket server on port ${PORT} (path ${WS_PATH})`)
})

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0))
})
