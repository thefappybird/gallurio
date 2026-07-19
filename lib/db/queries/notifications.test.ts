import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from '@/test-utils/mongo'

vi.mock('@/lib/db/mongoose', () => ({ connectDB: async () => undefined }))

import { Notification } from '@/lib/db/models/Notification'
import { getUnreadCount, getRecentNotifications, listNotifications } from './notifications'

const WS_A = new Types.ObjectId()
const WS_B = new Types.ObjectId()
const USER_A = 'user_a'
const USER_B = 'user_b'
const ENTITY_ID = new Types.ObjectId()

function makeNotification(
  overrides: Partial<{
    workspaceId: Types.ObjectId
    recipientWorkosUserId: string
    read: boolean
    createdAt: Date
  }> = {},
) {
  return {
    workspaceId: WS_A,
    recipientWorkosUserId: USER_A,
    type: 'inquiry.created' as const,
    entityId: ENTITY_ID,
    entityType: 'inquiry' as const,
    triggeredByWorkosUserId: 'trigger',
    read: false,
    readAt: null,
    title: 'New inquiry',
    body: 'You have a new inquiry',
    href: '/en/inquiries',
    ...overrides,
  }
}

beforeAll(async () => {
  await startInMemoryMongo()
})
afterAll(async () => {
  await stopInMemoryMongo()
})
beforeEach(async () => {
  await clearCollections()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('getUnreadCount', () => {
  it('returns the count of unread notifications for a user in a workspace', async () => {
    await Notification.create([
      makeNotification({ read: false }),
      makeNotification({ read: false }),
      makeNotification({ read: true }),
    ])

    const count = await getUnreadCount(String(WS_A), USER_A)
    expect(count).toBe(2)
  })

  it('ignores notifications for other users in the same workspace', async () => {
    await Notification.create([
      makeNotification({ recipientWorkosUserId: USER_A, read: false }),
      makeNotification({ recipientWorkosUserId: USER_B, read: false }),
      makeNotification({ recipientWorkosUserId: USER_B, read: false }),
    ])

    const count = await getUnreadCount(String(WS_A), USER_A)
    expect(count).toBe(1)
  })

  it('ignores notifications in other workspaces', async () => {
    await Notification.create([
      makeNotification({ workspaceId: WS_A, read: false }),
      makeNotification({ workspaceId: WS_B, read: false }),
    ])

    const count = await getUnreadCount(String(WS_A), USER_A)
    expect(count).toBe(1)
  })

  it('returns 0 when workspaceId is empty', async () => {
    const count = await getUnreadCount('', USER_A)
    expect(count).toBe(0)
  })

  it('returns 0 when workosUserId is empty', async () => {
    const count = await getUnreadCount(String(WS_A), '')
    expect(count).toBe(0)
  })
})

describe('params field', () => {
  it('includes params in returned notification docs', async () => {
    const params = { clientName: 'Test User' }
    await Notification.create({ ...makeNotification(), params })

    const results = await getRecentNotifications(String(WS_A), USER_A)
    expect((results[0] as unknown as { params: typeof params }).params).toEqual(params)
  })
})

describe('getRecentNotifications', () => {
  it('returns newest first up to the given limit', async () => {
    const dates = [
      new Date('2025-01-01T10:00:00Z'),
      new Date('2025-01-02T10:00:00Z'),
      new Date('2025-01-03T10:00:00Z'),
      new Date('2025-01-04T10:00:00Z'),
    ]
    for (const d of dates) {
      await Notification.create(makeNotification({ createdAt: d }))
    }

    const results = await getRecentNotifications(String(WS_A), USER_A, 3)
    expect(results).toHaveLength(3)
    // Newest first
    const resultDates = results.map((r) => new Date(r.createdAt as unknown as Date).getTime())
    expect(resultDates[0]).toBeGreaterThan(resultDates[1])
    expect(resultDates[1]).toBeGreaterThan(resultDates[2])
  })

  it('returns empty array when workspace or user is empty', async () => {
    await Notification.create(makeNotification())
    expect(await getRecentNotifications('', USER_A)).toEqual([])
    expect(await getRecentNotifications(String(WS_A), '')).toEqual([])
  })
})

describe('listNotifications', () => {
  it('returns newest first with default limit', async () => {
    const docs = Array.from({ length: 5 }, (_, i) =>
      makeNotification({ createdAt: new Date(Date.now() - i * 1000) }),
    )
    await Notification.create(docs)

    const { items, nextCursor } = await listNotifications(String(WS_A), USER_A)
    expect(items).toHaveLength(5)
    expect(nextCursor).toBeNull()
    const ts = items.map((r) => new Date(r.createdAt as unknown as Date).getTime())
    expect(ts[0]).toBeGreaterThanOrEqual(ts[1])
  })

  it('returns only items up to the given limit and provides a cursor', async () => {
    const docs = Array.from({ length: 5 }, (_, i) =>
      makeNotification({ createdAt: new Date(Date.now() - i * 1000) }),
    )
    await Notification.create(docs)

    const { items, nextCursor } = await listNotifications(String(WS_A), USER_A, { limit: 3 })
    expect(items).toHaveLength(3)
    expect(nextCursor).not.toBeNull()
  })

  it('cursor pagination: second page excludes items from first page', async () => {
    const docs = Array.from({ length: 6 }, (_, i) =>
      makeNotification({ createdAt: new Date(Date.now() - i * 10_000) }),
    )
    await Notification.create(docs)

    const page1 = await listNotifications(String(WS_A), USER_A, { limit: 3 })
    expect(page1.items).toHaveLength(3)
    expect(page1.nextCursor).not.toBeNull()

    const page2 = await listNotifications(String(WS_A), USER_A, {
      limit: 3,
      cursor: page1.nextCursor!,
    })
    expect(page2.items).toHaveLength(3)

    const page1Ids = new Set(page1.items.map((r) => String(r._id)))
    for (const item of page2.items) {
      expect(page1Ids.has(String(item._id))).toBe(false)
    }
  })

  it('tenant isolation: only returns docs for the given workspaceId + workosUserId', async () => {
    await Notification.create([
      makeNotification({ workspaceId: WS_A, recipientWorkosUserId: USER_A }),
      makeNotification({ workspaceId: WS_B, recipientWorkosUserId: USER_A }),
      makeNotification({ workspaceId: WS_A, recipientWorkosUserId: USER_B }),
    ])

    const { items } = await listNotifications(String(WS_A), USER_A)
    expect(items).toHaveLength(1)
    expect(String((items[0] as { workspaceId: Types.ObjectId }).workspaceId)).toBe(String(WS_A))
    expect(items[0].recipientWorkosUserId).toBe(USER_A)
  })

  it('returns empty result when workspace or user is empty', async () => {
    await Notification.create(makeNotification())
    const r1 = await listNotifications('', USER_A)
    expect(r1.items).toHaveLength(0)
    expect(r1.nextCursor).toBeNull()
    const r2 = await listNotifications(String(WS_A), '')
    expect(r2.items).toHaveLength(0)
    expect(r2.nextCursor).toBeNull()
  })
})
