process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(() => {
    process.exit(0)
  })
})

const { WebSocketServer } = require('ws')

const PORT = process.env.PORT || 3001
const wss = new WebSocketServer({ port: PORT })
const rooms = {}

wss.on('connection', (ws) => {
  let currentRoom = null

  ws.on('message', (data) => {
    const msg = JSON.parse(data)

    if (msg.type === 'create') {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      rooms[code] = { host: ws, guest: null }
      currentRoom = code
      ws.send(JSON.stringify({ type: 'created', code }))
    }

    if (msg.type === 'join') {
      const room = rooms[msg.code]
      if (!room) return ws.send(JSON.stringify({ type: 'error', msg: 'Room not found' }))
      if (room.guest) return ws.send(JSON.stringify({ type: 'error', msg: 'Room full' }))
      room.guest = ws
      currentRoom = msg.code
      ws.send(JSON.stringify({ type: 'joined', code: msg.code }))
      room.host.send(JSON.stringify({ type: 'guest_joined' }))
    }

    if (msg.type === 'signal') {
      const room = rooms[currentRoom]
      if (!room) return
      const other = room.host === ws ? room.guest : room.host
      if (other) other.send(JSON.stringify({ type: 'signal', data: msg.data }))
    }
  })

  ws.on('close', () => {
    if (currentRoom && rooms[currentRoom]) {
      const room = rooms[currentRoom]
      const other = room.host === ws ? room.guest : room.host
      if (other) other.send(JSON.stringify({ type: 'peer_left' }))
      delete rooms[currentRoom]
    }
  })
})

console.log(`Signaling server running on port ${PORT}`)