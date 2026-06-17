import type { Server } from 'socket.io'

declare global {
  // eslint-disable-next-line no-var
  var __io: Server | undefined
}

export function getIO(): Server | undefined {
  return global.__io
}

export function setIO(io: Server): void {
  global.__io = io
}
