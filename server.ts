import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { setIO } from './lib/sockets/io'
import { verifySocketToken } from './lib/sockets/auth'

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT ?? '3000', 10)
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  setIO(io)

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) return next(new Error('Missing token'))
    const payload = verifySocketToken(token)
    if (!payload) return next(new Error('Invalid token'))
    socket.data.workosUserId = payload.workosUserId
    socket.data.workspaceId = payload.workspaceId
    next()
  })

  io.on('connection', (socket) => {
    const { workosUserId, workspaceId } = socket.data as { workosUserId: string; workspaceId: string }
    void socket.join(`user:${workosUserId}`)
    void socket.join(`workspace:${workspaceId}`)
  })

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
