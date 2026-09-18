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
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// roomCode → Set<socketId>
const rooms = new Map<string, Set<string>>()

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

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`)

  // Создать новую комнату
  socket.on('create-room', () => {
    const code = generateRoomCode()
    rooms.set(code, new Set([socket.id]))
    socketToRoom.set(socket.id, code)
    socket.join(code)
    socket.emit('room-created', { code })
    console.log(`[room ${code}] created by ${socket.id}`)
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
    members.add(socket.id)
    socketToRoom.set(socket.id, upper)
    socket.join(upper)
    socket.emit('room-joined', { code: upper, members: members.size })
    // Сообщить остальным, что присоединился новый участник
    socket.to(upper).emit('peer-joined', { id: socket.id, members: members.size })
    console.log(`[room ${upper}] ${socket.id} joined (now ${members.size})`)
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
    if (room) {
      const members = rooms.get(room)
      if (members) {
        members.delete(socket.id)
        if (members.size === 0) {
          rooms.delete(room)
          console.log(`[room ${room}] emptied, removed`)
        } else {
          socket.to(room).emit('peer-left', { id: socket.id, members: members.size })
          console.log(`[room ${room}] ${socket.id} left (now ${members.size})`)
        }
      }
    }
    socketToRoom.delete(socket.id)
    console.log(`[-] ${socket.id}`)
  })

  socket.on('error', (err) => {
    console.error(`Socket error (${socket.id}):`, err)
  })
})

// Порт можно переопределить переменной окружения MP_PORT (по умолчанию 3003)
const PORT = Number(process.env.MP_PORT) || 3003
httpServer.listen(PORT, () => {
  console.log(`Nastolka WebSocket server on port ${PORT}`)
})

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0))
})
