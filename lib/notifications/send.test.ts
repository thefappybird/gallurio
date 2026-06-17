import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'

vi.mock('@/lib/db/mongoose', () => ({ connectDB: async () => undefined }))

const mockEmit = vi.fn()
const mockTo = vi.fn(() => ({ emit: mockEmit }))
const mockIO = { to: mockTo }

vi.mock('@/lib/sockets/io', () => ({
  getIO: () => mockIO,
}))

const sendNotificationEmail = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/email/notifications', () => ({
  sendNotificationEmail: (...args: unknown[]) => sendNotificationEmail(...args),
}))

const buildNotificationContent = vi.fn().mockResolvedValue({
  title: 'Test title',
  body: 'Test body',
  href: '/en/inquiries?inquiryId=abc',
})
vi.mock('@/lib/notifications/messages', () => ({
  buildNotificationContent: (...args: unknown[]) => buildNotificationContent(...args),
}))

vi.mock('@/lib/db/models/Notification', () => ({
  Notification: {
    insertMany: vi.fn(async (docs: unknown[]) => {
      // Return docs augmented with _id and createdAt like Mongoose does
      return (docs as Record<string, unknown>[]).map((d) => ({
        ...d,
        _id: new Types.ObjectId(),
        createdAt: new Date(),
      }))
    }),
  },
}))

import { sendNotification } from './send'
import { Notification } from '@/lib/db/models/Notification'
import type { SendNotificationOptions } from './types'

const WS_ID = String(new Types.ObjectId())
const ENTITY_ID = String(new Types.ObjectId())

function makeOpts(overrides: Partial<SendNotificationOptions> = {}): SendNotificationOptions {
  return {
    workspaceId: WS_ID,
    recipients: [
      { workosUserId: 'user-A', email: 'a@x.com', name: 'Alice' },
      { workosUserId: 'user-B', email: 'b@x.com', name: 'Bob' },
    ],
    type: 'inquiry.created',
    entityId: ENTITY_ID,
    entityType: 'inquiry',
    triggeredByWorkosUserId: 'trigger-user',
    locale: 'en',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(Notification.insertMany as ReturnType<typeof vi.fn>).mockImplementation(
    async (docs: unknown[]) => {
      return (docs as Record<string, unknown>[]).map((d) => ({
        ...d,
        _id: new Types.ObjectId(),
        createdAt: new Date(),
      }))
    },
  )
  buildNotificationContent.mockResolvedValue({
    title: 'Test title',
    body: 'Test body',
    href: '/en/inquiries?inquiryId=abc',
  })
  sendNotificationEmail.mockResolvedValue(undefined)
  mockTo.mockReturnValue({ emit: mockEmit })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sendNotification', () => {
  describe('self-exclusion', () => {
    it('excludes triggeredByWorkosUserId from recipients', async () => {
      await sendNotification(
        makeOpts({
          recipients: [
            { workosUserId: 'user-A', email: 'a@x.com' },
            { workosUserId: 'trigger', email: 't@x.com' },
          ],
          triggeredByWorkosUserId: 'trigger',
        }),
      )

      const insertCall = (Notification.insertMany as ReturnType<typeof vi.fn>).mock.calls[0][0] as unknown[]
      expect(insertCall).toHaveLength(1)
      expect((insertCall[0] as { recipientWorkosUserId: string }).recipientWorkosUserId).toBe('user-A')

      const emittedRooms = (mockTo.mock.calls as unknown as [string][]).map((c) => c[0])
      expect(emittedRooms).toContain('user:user-A')
      expect(emittedRooms).not.toContain('user:trigger')
    })
  })

  describe('all recipients excluded', () => {
    it('does nothing when all recipients are excluded', async () => {
      await sendNotification(
        makeOpts({
          recipients: [{ workosUserId: 'trigger', email: 't@x.com' }],
          triggeredByWorkosUserId: 'trigger',
        }),
      )

      expect(Notification.insertMany).not.toHaveBeenCalled()
      expect(mockEmit).not.toHaveBeenCalled()
      expect(sendNotificationEmail).not.toHaveBeenCalled()
    })
  })

  describe('DB write', () => {
    it('inserts one Notification doc per recipient', async () => {
      await sendNotification(
        makeOpts({
          recipients: [
            { workosUserId: 'user-A', email: 'a@x.com' },
            { workosUserId: 'user-B', email: 'b@x.com' },
          ],
          triggeredByWorkosUserId: 'trigger',
        }),
      )

      expect(Notification.insertMany).toHaveBeenCalledOnce()
      const docs = (Notification.insertMany as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<{
        workspaceId: string
        type: string
        entityId: string
        recipientWorkosUserId: string
      }>
      expect(docs).toHaveLength(2)
      expect(docs[0].workspaceId).toBe(WS_ID)
      expect(docs[0].type).toBe('inquiry.created')
      expect(docs[0].entityId).toBe(ENTITY_ID)
    })
  })

  describe('socket emit', () => {
    it('emits notification:new to correct user rooms', async () => {
      await sendNotification(
        makeOpts({
          recipients: [{ workosUserId: 'user-A', email: 'a@x.com' }],
          triggeredByWorkosUserId: 'trigger',
        }),
      )

      expect(mockTo).toHaveBeenCalledWith('user:user-A')
      expect(mockEmit).toHaveBeenCalledWith(
        'notification:new',
        expect.objectContaining({
          type: 'inquiry.created',
          title: 'Test title',
          body: 'Test body',
          href: '/en/inquiries?inquiryId=abc',
          read: false,
          readAt: null,
        }),
      )
    })
  })

  describe('email non-blocking', () => {
    it('does not throw when email fails', async () => {
      sendNotificationEmail.mockRejectedValue(new Error('mail server down'))

      await expect(
        sendNotification(
          makeOpts({
            recipients: [{ workosUserId: 'user-A', email: 'a@x.com' }],
            triggeredByWorkosUserId: 'trigger',
          }),
        ),
      ).resolves.toBeUndefined()
    })
  })

  describe('tenant isolation', () => {
    it('scopes every inserted doc to the given workspaceId', async () => {
      const targetWsId = String(new Types.ObjectId())
      await sendNotification(
        makeOpts({
          workspaceId: targetWsId,
          recipients: [
            { workosUserId: 'user-A', email: 'a@x.com' },
            { workosUserId: 'user-B', email: 'b@x.com' },
          ],
          triggeredByWorkosUserId: 'trigger',
        }),
      )

      const docs = (Notification.insertMany as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<{
        workspaceId: string
      }>
      for (const doc of docs) {
        expect(doc.workspaceId).toBe(targetWsId)
      }
    })
  })
})
