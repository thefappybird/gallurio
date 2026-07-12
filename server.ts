import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { setIO } from './lib/sockets/io'
import { verifySocketToken } from './lib/sockets/auth'

// Ensure NODE_ENV is set so that downstream code (e.g. Turnstile dev bypass,
// Next.js internals) can distinguish dev from prod. The pnpm scripts set
// NODE_ENV explicitly via cross-env ("dev" => "development", "start" =>
// "production"). This fallback only fires for a bare `tsx server.ts`
// invocation (e.g. a CI script that forgot to export NODE_ENV). It MUST
// default to "production" so the Turnstile bypass can never accidentally
// enable. NODE_ENV is typed read-only in @types/node; we set it early via the
// index-signature cast before Next.js reads it.
if (!(process.env as Record<string, string | undefined>)["NODE_ENV"]) {
  (process.env as Record<string, string>)["NODE_ENV"] = "production"
}

// Validates the production env matrix at runtime startup and throws before
// Next boots on a bad config. Must run after the NODE_ENV fallback above.
// NEVER call this at import time in a module `next build` might load — see
// lib/env.ts for why (build-time NODE_ENV=production without real secrets).
import { validateEnv } from './lib/env'
validateEnv()

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
