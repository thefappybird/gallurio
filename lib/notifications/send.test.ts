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
import * as ioModule from '@/lib/sockets/io'
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
  describe('actor-silent delivery', () => {
    it('persists actor with read:true, silent:true and does NOT emit loud notification to actor', async () => {
      await sendNotification(
        makeOpts({
          recipients: [
            { workosUserId: 'user-A', email: 'a@x.com' },
            { workosUserId: 'actor', email: 'actor@x.com' },
          ],
          triggeredByWorkosUserId: 'actor',
        }),
      )

      // Both should be inserted
      const docs = (Notification.insertMany as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as Array<{ recipientWorkosUserId: string; read: boolean; silent: boolean }>
      expect(docs).toHaveLength(2)

      const actorDoc = docs.find((d) => d.recipientWorkosUserId === 'actor')
      expect(actorDoc).toBeDefined()
      expect(actorDoc!.read).toBe(true)
      expect(actorDoc!.silent).toBe(true)

      const nonActorDoc = docs.find((d) => d.recipientWorkosUserId === 'user-A')
      expect(nonActorDoc).toBeDefined()
      expect(nonActorDoc!.read).toBe(false)
      expect(nonActorDoc!.silent).toBe(false)

      // No loud emit to actor
      const emittedRooms = (mockTo.mock.calls as unknown as [string][]).map((c) => c[0])
      expect(emittedRooms).toContain('user:user-A')
      expect(emittedRooms).not.toContain('user:actor')
    })

    it('does NOT send email to actor', async () => {
      await sendNotification(
        makeOpts({
          recipients: [
            { workosUserId: 'user-A', email: 'a@x.com' },
            { workosUserId: 'actor', email: 'actor@x.com' },
          ],
          triggeredByWorkosUserId: 'actor',
        }),
      )

      const emailRecipients = (sendNotificationEmail.mock.calls as Array<[{ recipient: { workosUserId: string } }]>).map(
        (c) => c[0].recipient.workosUserId,
      )
      expect(emailRecipients).toContain('user-A')
      expect(emailRecipients).not.toContain('actor')
    })

    it('non-actor gets loud emit with read:false, silent:false', async () => {
      await sendNotification(
        makeOpts({
          recipients: [
            { workosUserId: 'non-actor', email: 'na@x.com' },
            { workosUserId: 'actor', email: 'actor@x.com' },
          ],
          triggeredByWorkosUserId: 'actor',
        }),
      )

      expect(mockTo).toHaveBeenCalledWith('user:non-actor')
      expect(mockEmit).toHaveBeenCalledWith(
        'notification:new',
        expect.objectContaining({
          read: false,
          silent: false,
        }),
      )
    })
  })

  describe('all recipients excluded (empty list)', () => {
    it('does nothing when recipients list is empty', async () => {
      await sendNotification(
        makeOpts({
          recipients: [],
          triggeredByWorkosUserId: 'actor',
        }),
      )

      expect(Notification.insertMany).not.toHaveBeenCalled()
      expect(mockEmit).not.toHaveBeenCalled()
      expect(sendNotificationEmail).not.toHaveBeenCalled()
    })
  })

  describe('actor-only recipients', () => {
    it('persists actor doc silently but emits nothing and sends no email', async () => {
      await sendNotification(
        makeOpts({
          recipients: [{ workosUserId: 'actor', email: 'actor@x.com' }],
          triggeredByWorkosUserId: 'actor',
        }),
      )

      // DB write happens (actor gets a silent record)
      expect(Notification.insertMany).toHaveBeenCalledOnce()
      const docs = (Notification.insertMany as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<{
        read: boolean
        silent: boolean
      }>
      expect(docs[0].read).toBe(true)
      expect(docs[0].silent).toBe(true)

      // No socket emit, no email
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

  describe('params persistence', () => {
    it('persists params from opts.vars onto each inserted doc', async () => {
      const vars = { clientName: 'Alice' }
      await sendNotification(
        makeOpts({
          vars,
          recipients: [{ workosUserId: 'user-A', email: 'a@x.com' }],
          triggeredByWorkosUserId: 'trigger',
        }),
      )

      const docs = (Notification.insertMany as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<{
        params: typeof vars
      }>
      expect(docs[0].params).toEqual(vars)
    })

    it('persists empty params object when vars is undefined', async () => {
      await sendNotification(
        makeOpts({
          recipients: [{ workosUserId: 'user-A', email: 'a@x.com' }],
          triggeredByWorkosUserId: 'trigger',
        }),
      )

      const docs = (Notification.insertMany as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<{
        params: Record<string, unknown>
      }>
      expect(docs[0].params).toEqual({})
    })

    it('includes params in the socket emit payload', async () => {
      const vars = { clientName: 'Bob' }
      await sendNotification(
        makeOpts({
          vars,
          recipients: [{ workosUserId: 'user-A', email: 'a@x.com' }],
          triggeredByWorkosUserId: 'trigger',
        }),
      )

      const emitArgs = mockEmit.mock.calls[0] as [string, { params?: typeof vars }]
      expect(emitArgs[1].params).toEqual(vars)
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

  describe('persist before emit / no-socket resilience', () => {
    it('persists to DB even when getIO() returns undefined (socket unavailable)', async () => {
      const spy = vi.spyOn(ioModule, 'getIO').mockReturnValue(undefined)
      try {
        await sendNotification(
          makeOpts({
            recipients: [{ workosUserId: 'user-A', email: 'a@x.com' }],
            triggeredByWorkosUserId: 'trigger',
          }),
        )
      } finally {
        spy.mockRestore()
      }

      // DB write must have happened unconditionally.
      expect(Notification.insertMany).toHaveBeenCalledOnce()
      // Socket emit must NOT have been attempted.
      expect(mockTo).not.toHaveBeenCalled()
      expect(mockEmit).not.toHaveBeenCalled()
    })

    it('persists to DB before emitting (insertMany called before any emit)', async () => {
      const callOrder: string[] = []
      ;(Notification.insertMany as ReturnType<typeof vi.fn>).mockImplementation(
        async (docs: unknown[]) => {
          callOrder.push('insertMany')
          return (docs as Record<string, unknown>[]).map((d) => ({
            ...d,
            _id: new Types.ObjectId(),
            createdAt: new Date(),
          }))
        },
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mockTo as any).mockImplementation((room: string) => {
        callOrder.push(`emit:${room}`)
        return { emit: mockEmit }
      })

      await sendNotification(
        makeOpts({
          recipients: [{ workosUserId: 'user-A', email: 'a@x.com' }],
          triggeredByWorkosUserId: 'trigger',
        }),
      )

      expect(callOrder[0]).toBe('insertMany')
      expect(callOrder[1]).toBe('emit:user:user-A')
    })
  })
})
