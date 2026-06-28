import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const notificationSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    recipientWorkosUserId: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: [
        'inquiry.created',
        'booking.team_assigned',
        'booking.status_changed',
        'team.invitation',
        'team.removed',
        'team.deleted',
      ],
    },
    entityId: { type: Schema.Types.ObjectId, required: true },
    entityType: { type: String, required: true, enum: ['inquiry', 'booking', 'team'] },
    triggeredByWorkosUserId: { type: String, required: true },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    silent: { type: Boolean, default: false },
    title: { type: String, required: true },
    body: { type: String, required: true },
    href: { type: String, required: true },
    // Dynamic template vars used to re-render the notification in the viewer's locale at read time.
    // Stored as Mixed so the shape can evolve without a schema migration.
    params: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

notificationSchema.index({ workspaceId: 1, recipientWorkosUserId: 1, read: 1, createdAt: -1 })
notificationSchema.index({ workspaceId: 1, recipientWorkosUserId: 1, createdAt: -1 })

export type NotificationType =
  | 'inquiry.created'
  | 'booking.team_assigned'
  | 'booking.status_changed'
  | 'team.invitation'
  | 'team.removed'
  | 'team.deleted'

export type INotification = Omit<InferSchemaType<typeof notificationSchema>, 'params'> & {
  _id: mongoose.Types.ObjectId
  /** Template vars for render-time i18n translation. Missing on legacy rows — fall back to title/body. */
  params?: Record<string, string | undefined>
}

export const Notification: Model<INotification> =
  (mongoose.models.Notification as Model<INotification>) ??
  mongoose.model<INotification>('Notification', notificationSchema)
