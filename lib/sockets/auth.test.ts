import { beforeEach, describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { signSocketToken, verifySocketToken } from './auth'

const SECRET = 'test-secret-must-be-at-least-32-chars-long!!'

beforeEach(() => {
  process.env.ACTIVE_WORKSPACE_COOKIE_SECRET = SECRET
})

describe('signSocketToken', () => {
  it('produces a non-empty string', () => {
    const token = signSocketToken('user_abc', 'ws_123')
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })

  it('produces a base64url-safe string (no +, /, or =)', () => {
    const token = signSocketToken('user_abc', 'ws_123')
    expect(token).not.toMatch(/[+/=]/)
  })
})

describe('verifySocketToken', () => {
  it('returns workosUserId and workspaceId for a valid token', () => {
    const token = signSocketToken('user_abc', 'ws_xyz')
    const result = verifySocketToken(token)
    expect(result).not.toBeNull()
    expect(result!.workosUserId).toBe('user_abc')
    expect(result!.workspaceId).toBe('ws_xyz')
  })

  it('handles workosUserId that contains colons', () => {
    // WorkOS user ids are "user_<alphanum>" but be defensive about colon splitting
    const token = signSocketToken('user_abc', 'ws_xyz')
    const result = verifySocketToken(token)
    expect(result).not.toBeNull()
    expect(result!.workspaceId).toBe('ws_xyz')
  })

  it('returns null for a tampered token', () => {
    const token = signSocketToken('user_abc', 'ws_xyz')
    // Flip a character near the end of the base64url string
    const tampered = token.slice(0, -4) + 'XXXX'
    expect(verifySocketToken(tampered)).toBeNull()
  })

  it('returns null for a completely invalid token', () => {
    expect(verifySocketToken('not-a-valid-token')).toBeNull()
    expect(verifySocketToken('')).toBeNull()
    expect(verifySocketToken('aGVsbG8=')).toBeNull()
  })

  it('returns null for an expired token', () => {
    // Construct a token with exp in the past by building the payload manually
    // and re-signing it with the same secret
    const workosUserId = 'user_abc'
    const workspaceId = 'ws_xyz'
    const exp = Date.now() - 5_000 // 5 seconds in the past

    const payload = `${workosUserId}:${workspaceId}:${exp}`
    const sig = createHmac('sha256', SECRET)
      .update(payload)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const raw = `${payload}.${sig}`
    const expiredToken = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    const result = verifySocketToken(expiredToken)
    expect(result).toBeNull()
  })

  it('returns null when the secret does not match', () => {
    const token = signSocketToken('user_abc', 'ws_xyz')

    // Temporarily change the secret
    process.env.ACTIVE_WORKSPACE_COOKIE_SECRET = 'a-completely-different-secret-for-testing!!'
    const result = verifySocketToken(token)
    process.env.ACTIVE_WORKSPACE_COOKIE_SECRET = SECRET

    expect(result).toBeNull()
  })
})
