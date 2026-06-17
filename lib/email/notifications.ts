import 'server-only'
import { sendEmail } from './send'
import type { NotificationType } from '@/lib/notifications/types'

const TEAM_TYPES = new Set<NotificationType>([
  'team.invitation',
  'team.removed',
  'team.deleted',
])

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface NotificationEmailOpts {
  recipient: { email: string; name?: string }
  title: string
  body: string
  href: string
  type: NotificationType
}

export async function sendNotificationEmail(opts: NotificationEmailOpts): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''
  const isTeam = TEAM_TYPES.has(opts.type)

  const subject = isTeam ? opts.title : 'New notification — Gallurio'
  const actionUrl = isTeam ? `${appUrl}${opts.href}` : `${appUrl}/notifications`
  const actionLabel = isTeam ? 'View' : 'View all notifications'

  const bodyText = isTeam ? `${opts.title}\n\n${opts.body}` : 'You have a new notification.'

  const text = [bodyText, '', `${actionLabel}: ${actionUrl}`].join('\n')

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:560px;">
      <h2 style="margin:0 0 8px;font-size:18px;">${escapeHtml(isTeam ? opts.title : 'New notification')}</h2>
      ${isTeam ? `<p style="margin:0 0 16px;font-size:14px;color:#444;">${escapeHtml(opts.body)}</p>` : '<p style="margin:0 0 16px;font-size:14px;color:#444;">You have a new notification.</p>'}
      <p style="margin-top:24px;">
        <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;text-decoration:none;font-size:14px;">${escapeHtml(actionLabel)}</a>
      </p>
    </div>
  `

  await sendEmail({ to: opts.recipient.email, subject, text, html })
}
