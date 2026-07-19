import { createHmac, timingSafeEqual } from 'crypto'

function toBase64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function hmac(data: string): string {
  const secret = process.env.ACTIVE_WORKSPACE_COOKIE_SECRET
  if (!secret) throw new Error('ACTIVE_WORKSPACE_COOKIE_SECRET is not set')
  return toBase64url(createHmac('sha256', secret).update(data).digest())
}

export function signSocketToken(workosUserId: string, workspaceId: string): string {
  const exp = Date.now() + 60_000
  const payload = `${workosUserId}:${workspaceId}:${exp}`
  const sig = hmac(payload)
  return toBase64url(Buffer.from(`${payload}.${sig}`))
}

export function verifySocketToken(token: string): { workosUserId: string; workspaceId: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const lastDot = decoded.lastIndexOf('.')
    if (lastDot === -1) return null
    const payload = decoded.slice(0, lastDot)
    const sig = decoded.slice(lastDot + 1)
    const expected = hmac(payload)
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const parts = payload.split(':')
    if (parts.length < 3) return null
    const exp = parseInt(parts[parts.length - 1], 10)
    if (Date.now() > exp) return null
    const workspaceId = parts[parts.length - 2]
    const workosUserId = parts.slice(0, parts.length - 2).join(':')
    return { workosUserId, workspaceId }
  } catch {
    return null
  }
}
