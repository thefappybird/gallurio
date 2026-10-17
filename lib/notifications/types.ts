export type NotificationType =
  | 'inquiry.created'
  | 'booking.team_assigned'
  | 'booking.status_changed'
  | 'booking.import_completed'
  | 'booking.import_partial'
  | 'booking.import_failed'
  | 'team.invitation'
  | 'team.invite_accepted'
  | 'team.removed'
  | 'team.deleted'

export type NotificationEntityType = 'inquiry' | 'booking' | 'booking_import' | 'team'

export interface NotificationVars {
  clientName?: string
  assignerName?: string
  inviterName?: string
  memberName?: string
  memberEmail?: string
  role?: string
  teamName?: string
  actorName?: string
  newStatus?: string
  importViewer?: 'owner' | 'team'
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
  /** Background job updates use the in-app bell without sending email. */
  inAppOnly?: boolean
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
  /** Template vars forwarded for render-time translation in the viewer's locale. */
  params?: NotificationVars
}
