import { createTranslator } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { applyVocabulary } from '@/lib/vocabulary/apply'
import type { VocabularyPresetId } from '@/lib/vocabulary/presets'
import type { NotificationType, NotificationEntityType, NotificationVars } from './types'

function buildHref(
  locale: string,
  type: NotificationType,
  entityId: string,
  vars: NotificationVars,
): string {
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
    case 'team.invite_accepted': {
      const params = new URLSearchParams({ members: 'active' })
      if (vars.memberEmail) params.set('member', vars.memberEmail)
      return `/${locale}/teams?${params.toString()}`
    }
  }
}

export async function buildNotificationContent(
  type: NotificationType,
  locale: string,
  entityId: string,
  _entityType: NotificationEntityType,
  vars: NotificationVars,
  preset?: VocabularyPresetId,
): Promise<{ title: string; body: string; href: string }> {
  // Catalog strings carry %tokens%; always resolve them (standard when no preset).
  const t = createTranslator({
    locale,
    messages: applyVocabulary(await getMessages({ locale }), locale, preset ?? "standard"),
    namespace: "app.notifications" as never,
  });
  const title = t(`types.${type}.title`, vars as Record<string, string>)
  const body = t(`types.${type}.body`, vars as Record<string, string>)
  const href = buildHref(locale, type, entityId, vars)
  return { title, body, href }
}
