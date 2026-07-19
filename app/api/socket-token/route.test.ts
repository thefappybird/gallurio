import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'

// Mock NextResponse so the route returns a plain object we can inspect
type MockResp = { body: unknown; status: number }
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    NextResponse: {
      json: (body: unknown, init?: ResponseInit): MockResp => ({
        body,
        status: init?.status ?? 200,
      }),
    },
  }
})

vi.mock('@/lib/db/mongoose', () => ({ connectDB: async () => undefined }))

// Mutable holders flipped per test
let mockAuthUser: { workosUserId: string; email: string; name: string; avatarUrl: null } | null =
  null
vi.mock('@/lib/auth/session', () => ({
  getAuthUser: async () => mockAuthUser,
}))

const workspaceId = String(new Types.ObjectId())
let mockWorkspaceId: string | null = workspaceId

vi.mock('@/lib/auth/activeWorkspace', () => ({
  getActiveWorkspaceId: async () => mockWorkspaceId,
}))

// User.findOne returns a stub with a memberships array
vi.mock('@/lib/db/models', () => ({
  User: {
    findOne: () => ({
      select: () => ({
        lean: async () => ({ memberships: [{ workspaceId }] }),
      }),
    }),
  },
}))

import { GET } from './route'
import { verifySocketToken } from '@/lib/sockets/auth'

beforeEach(() => {
  vi.clearAllMocks()
  mockAuthUser = {
    workosUserId: 'user_test_123',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: null,
  }
  mockWorkspaceId = workspaceId

  // Ensure ACTIVE_WORKSPACE_COOKIE_SECRET is set for signSocketToken
  process.env.ACTIVE_WORKSPACE_COOKIE_SECRET = 'test-secret-must-be-at-least-32-chars-long!!'
})

describe('GET /api/socket-token', () => {
  it('returns 401 when no auth session exists', async () => {
    mockAuthUser = null
    const res = (await GET()) as unknown as MockResp
    expect(res.status).toBe(401)
    expect((res.body as { error: string }).error).toBe('Not authenticated')
  })

  it('returns 401 when no active workspace is found', async () => {
    mockWorkspaceId = null
    const res = (await GET()) as unknown as MockResp
    expect(res.status).toBe(401)
    expect((res.body as { error: string }).error).toBe('No active workspace')
  })

  it('returns { token: string } with a valid session', async () => {
    const res = (await GET()) as unknown as MockResp
    expect(res.status).toBe(200)
    expect(typeof (res.body as { token: string }).token).toBe('string')
    expect((res.body as { token: string }).token.length).toBeGreaterThan(0)
  })

  it('returned token is verifiable by verifySocketToken', async () => {
    const res = (await GET()) as unknown as MockResp
    expect(res.status).toBe(200)
    const { token } = res.body as { token: string }
    const verified = verifySocketToken(token)
    expect(verified).not.toBeNull()
    expect(verified!.workosUserId).toBe('user_test_123')
    expect(verified!.workspaceId).toBe(workspaceId)
  })
})
