import { connectDB } from '@/lib/db/mongoose'
import { Notification } from '@/lib/db/models/Notification'
import { getIO } from '@/lib/sockets/io'
import { buildNotificationContent } from './messages'
import { sendNotificationEmail } from '@/lib/email/notifications'
import type { SendNotificationOptions, SerializedNotificationPayload } from './types'

export async function sendNotification(opts: SendNotificationOptions): Promise<void> {
  if (opts.recipients.length === 0) return

  await connectDB()

  const payloads = await Promise.all(
    opts.recipients.map(async (r) => {
      const isActor = r.workosUserId === opts.triggeredByWorkosUserId
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
        read: isActor,
        readAt: isActor ? new Date() : null,
        silent: isActor,
        title,
        body,
        href,
      }
    }),
  )

  // ORDERING GUARANTEE: DB persistence is unconditional and always happens before
  // any socket emit. Notifications are saved even when getIO() is undefined
  // (socket server unavailable), so users see them on next login via the DB list.
  const inserted = await Notification.insertMany(payloads)
  const io = getIO()

  inserted.forEach((doc, i) => {
    const recipient = opts.recipients[i]
    const isActor = recipient.workosUserId === opts.triggeredByWorkosUserId

    // Actors get a silent record in DB but no loud socket emit — they see it on next fetch.
    if (!isActor && io) {
      console.log(`[notifications] emit notification:new -> user:${doc.recipientWorkosUserId}`)
      const payload: SerializedNotificationPayload = {
        _id: String(doc._id),
        type: doc.type,
        title: doc.title,
        body: doc.body,
        href: doc.href,
        entityId: String(doc.entityId),
        entityType: doc.entityType,
        read: false,
        readAt: null,
        silent: false,
        createdAt: doc.createdAt,
      }
      io.to(`user:${doc.recipientWorkosUserId}`).emit('notification:new', payload)
    }

    // Email only for non-actors.
    if (!isActor) {
      void sendNotificationEmail({
        recipient,
        title: doc.title,
        body: doc.body,
        href: doc.href,
        type: doc.type,
      }).catch(() => {})
    }
  })
}
