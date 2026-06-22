import { getTranslations } from 'next-intl/server'
import type { NotificationType, NotificationEntityType, NotificationVars } from './types'

function buildHref(locale: string, type: NotificationType, entityId: string): string {
  switch (type) {
    case 'inquiry.created':
      return `/${locale}/inquiries?inquiryId=${entityId}`
    case 'booking.team_assigned':
    case 'booking.status_changed':
      return `/${locale}/bookings?detail=${entityId}`
    case 'team.invitation':
    case 'team.removed':
    case 'team.deleted':
      return `/${locale}/teams`
  }
}

export async function buildNotificationContent(
  type: NotificationType,
  locale: string,
  entityId: string,
  _entityType: NotificationEntityType,
  vars: NotificationVars,
): Promise<{ title: string; body: string; href: string }> {
  const t = await getTranslations({ locale, namespace: 'app.notifications' })
  const title = t(`types.${type}.title`, vars as Record<string, string>)
  const body = t(`types.${type}.body`, vars as Record<string, string>)
  const href = buildHref(locale, type, entityId)
  return { title, body, href }
}
