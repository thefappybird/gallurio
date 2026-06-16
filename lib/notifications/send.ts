import { connectDB } from '@/lib/db/mongoose'
import { Notification } from '@/lib/db/models/Notification'
import { getIO } from '@/lib/sockets/io'
import { buildNotificationContent } from './messages'
import { sendNotificationEmail } from '@/lib/email/notifications'
import type { SendNotificationOptions } from './types'

export async function sendNotification(opts: SendNotificationOptions): Promise<void> {
  const recipients = opts.recipients.filter(
    (r) => r.workosUserId !== opts.triggeredByWorkosUserId,
  )
  if (recipients.length === 0) return

  await connectDB()

  const payloads = await Promise.all(
    recipients.map(async (r) => {
      const { title, body, href } = await buildNotificationContent(
        opts.type,
        opts.locale,
        opts.entityId,
        opts.entityType,
        opts.vars ?? {},
      )
      return {
        workspaceId: opts.workspaceId,
        recipientWorkosUserId: r.workosUserId,
        type: opts.type,
        entityId: opts.entityId,
        entityType: opts.entityType,
        triggeredByWorkosUserId: opts.triggeredByWorkosUserId,
        read: false,
        readAt: null,
        title,
        body,
        href,
      }
    }),
  )

  const inserted = await Notification.insertMany(payloads)
  const io = getIO()

  inserted.forEach((doc, i) => {
    if (io) {
      io.to(`user:${doc.recipientWorkosUserId}`).emit('notification:new', {
        _id: String(doc._id),
        type: doc.type,
        title: doc.title,
        body: doc.body,
        href: doc.href,
        entityId: String(doc.entityId),
        entityType: doc.entityType,
        read: false,
        readAt: null,
        createdAt: doc.createdAt,
      })
    }
    void sendNotificationEmail({
      recipient: recipients[i],
      title: doc.title,
      body: doc.body,
      href: doc.href,
      type: doc.type,
    }).catch(() => {})
  })
}
