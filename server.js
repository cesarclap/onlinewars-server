const { WebSocketServer } = require('ws')
const http = require('http')

const PORT = process.env.PORT || 8080

const server = http.createServer((req, res) => {
  res.writeHead(200)
  res.end('OnlineWars signaling server running')
})

const wss = new WebSocketServer({ server })
const rooms = {}

wss.on('connection', (ws) => {
  console.log('New connection')
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

process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Signaling server running on port ${PORT}`)
})