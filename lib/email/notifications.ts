import 'server-only'
import { sendEmail } from './send'
import { renderBrandedEmail } from './layout'
import { gallurioBrand } from './brand'
import type { NotificationType } from '@/lib/notifications/types'

const TEAM_TYPES = new Set<NotificationType>([
  'team.invitation',
  'team.invite_accepted',
  'team.removed',
  'team.deleted',
])

interface NotificationEmailOpts {
  recipient: { email: string; name?: string }
  title: string
  body: string
  href: string
  type: NotificationType
}

export async function sendNotificationEmail(opts: NotificationEmailOpts): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  const isTeam = TEAM_TYPES.has(opts.type)

  const subject = isTeam ? opts.title : 'New notification — Gallurio'
  const ctaUrl = appUrl ? `${appUrl}${opts.href}` : null

  const { html, text, attachments } = renderBrandedEmail({
    brand: gallurioBrand(),
    locale: 'en',
    preheader: opts.body,
    title: opts.title,
    blocks: [
      { type: 'p', text: opts.body },
      ...(ctaUrl ? [] : [{ type: 'p' as const, text: 'Open the app to view this notification.' }]),
    ],
    ...(ctaUrl ? { cta: { label: 'View', url: ctaUrl } } : {}),
  })

  await sendEmail({ to: opts.recipient.email, subject, html, text, attachments }).catch(() => {})
}
