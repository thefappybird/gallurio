export type NotificationType =
  | 'inquiry.created'
  | 'booking.team_assigned'
  | 'booking.status_changed'
  | 'team.invitation'
  | 'team.removed'
  | 'team.deleted'

export type NotificationEntityType = 'inquiry' | 'booking' | 'team'

export interface NotificationVars {
  clientName?: string
  assignerName?: string
  inviterName?: string
  teamName?: string
  actorName?: string
  newStatus?: string
}

export interface NotificationRecipient {
  workosUserId: string
  email: string
  name?: string
}

export interface SendNotificationOptions {
  workspaceId: string
  recipients: NotificationRecipient[]
  type: NotificationType
  entityId: string
  entityType: NotificationEntityType
  triggeredByWorkosUserId: string
  locale: string
  vars?: NotificationVars
}

export interface SerializedNotificationPayload {
  _id: string
  type: string
  title: string
  body: string
  href: string
  entityId: string
  entityType: string
  read: boolean
  readAt: string | null
  silent?: boolean
  createdAt: Date | string
}
