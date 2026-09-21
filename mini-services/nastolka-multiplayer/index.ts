// WebSocket сервер для синхронизации состояния игры Настолка между устройствами.
// Запускается на порту 3003 (см. Caddyfile для проксирования через XTransformPort).
//
// Архитектура:
//   - Клиент создаёт комнату → получает код (4 символа)
//   - Второй клиент вводит код → присоединяется к комнате
//   - Любой клиент отправляет state-update с полным состоянием игры
//   - Сервер ретранслирует его всем остальным участникам комнаты
//
// Состояние не хранится на сервере — каждый клиент держит своё и отправляет
// обновления. Сервер — просто ретранслятор.

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

// roomCode → Set<socketId>
const rooms = new Map<string, Set<string>>()

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

// socketId → roomCode (для быстрого выхода)
const socketToRoom = new Map<string, string>()

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // без похожих символов
const generateRoomCode = () => {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return rooms.has(code) ? generateRoomCode() : code
}

const leaveRoom = (socketId: string, notify = true) => {
  const room = socketToRoom.get(socketId)
  if (!room) return
  io.sockets.sockets.get(socketId)?.leave(room)
  const members = rooms.get(room)
  if (members) {
    members.delete(socketId)
    if (members.size === 0) {
      rooms.delete(room)
      console.log(`[room ${room}] emptied, removed`)
    } else if (notify) {
      io.to(room).emit('peer-left', { id: socketId, members: members.size })
      console.log(`[room ${room}] ${socketId} left (now ${members.size})`)
    }
  }
  socketToRoom.delete(socketId)
}

io.on('connection', (socket) => {
  const ip = getClientIp(socket)
  console.log(`[+] ${socket.id} (${ip})`)
  writeLog('connect', { socketId: socket.id, ip })

  // Создать новую комнату
  socket.on('create-room', () => {
    leaveRoom(socket.id)
    const code = generateRoomCode()
    rooms.set(code, new Set([socket.id]))
    socketToRoom.set(socket.id, code)
    socket.join(code)
    socket.emit('room-created', { code })
    console.log(`[room ${code}] created by ${socket.id}`)
    writeLog('room-created', { socketId: socket.id, ip, room: code })
  })

  // Присоединиться к существующей комнате
  socket.on('join-room', ({ code }: { code: string }) => {
    const upper = (code || '').toUpperCase().trim()
    const members = rooms.get(upper)
    if (!members) {
      socket.emit('room-error', { message: 'Комната не найдена' })
      return
    }
    if (members.size >= 4) {
      socket.emit('room-error', { message: 'Комната уже заполнена (макс 4 игрока)' })
      return
    }
    leaveRoom(socket.id)
    members.add(socket.id)
    socketToRoom.set(socket.id, upper)
    socket.join(upper)
    socket.emit('room-joined', { code: upper, members: members.size })
    // Сообщить остальным, что присоединился новый участник
    socket.to(upper).emit('peer-joined', { id: socket.id, members: members.size })
    console.log(`[room ${upper}] ${socket.id} joined (now ${members.size})`)
    writeLog('room-joined', { socketId: socket.id, ip, room: upper })
  })

  // Синхронизация состояния игры
  socket.on('state-update', ({ state }: { state: unknown }) => {
    const room = socketToRoom.get(socket.id)
    if (!room) return
    // Ретранслируем всем остальным в комнате (не себе)
    socket.to(room).emit('state-update', { from: socket.id, state })
  })

  // Запрос текущего состояния у участников (новый участник просит)
  socket.on('request-state', () => {
    const room = socketToRoom.get(socket.id)
    if (!room) return
    socket.to(room).emit('state-requested', { from: socket.id })
  })

  // Ответить другому участнику состоянием (один из участников отвечает)
  socket.on('send-state-to', ({ to, state }: { to: string; state: unknown }) => {
    const room = socketToRoom.get(socket.id)
    if (!room || socketToRoom.get(to) !== room) return
    io.to(to).emit('state-update', { from: socket.id, state })
  })

  // Метаданные клиента (роль, режим синхронизации)
  socket.on('meta-update', ({ meta }: { meta: unknown }) => {
    const room = socketToRoom.get(socket.id)
    if (!room) return
    socket.to(room).emit('meta-update', { from: socket.id, meta })
  })

  // Поиск пары: ping для проверки соединения
  socket.on('ping-test', () => {
    socket.emit('pong-test', { time: Date.now() })
  })

  socket.on('disconnect', () => {
    const room = socketToRoom.get(socket.id)
    leaveRoom(socket.id)
    writeLog('disconnect', { socketId: socket.id, ip, room: room || null })
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
