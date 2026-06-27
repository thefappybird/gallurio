'use client'

import { useParams, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  BellIcon,
  CalendarIcon,
  MessageSquareIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import { useNotifications } from '@/lib/hooks/useNotifications'
import type { SerializedNotification } from '@/components/notifications/NotificationProvider'
import { useSidebar } from '@/components/ui/sidebar'

// ─── Relative time helper ────────────────────────────────────────────────────

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(isoDate).toLocaleDateString()
}

// ─── Per-type icon ────────────────────────────────────────────────────────────

function NotificationIcon({ type }: { type: string }) {
  const cls = 'size-4 shrink-0 text-sidebar-foreground/70'
  if (type.startsWith('inquiry')) return <MessageSquareIcon className={cls} />
  if (type.startsWith('booking')) return <CalendarIcon className={cls} />
  if (type.startsWith('team')) return <UsersIcon className={cls} />
  return <BellIcon className={cls} />
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotificationRow({
  notification,
  onClose,
}: {
  notification: SerializedNotification
  onClose: () => void
}) {
  const { markRead } = useNotifications()
  const router = useRouter()

  function handleClick() {
    if (!notification.read) markRead(notification._id)
    router.push(notification.href)
    onClose()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={[
        'flex w-full items-start gap-3 px-4 py-3 text-start transition-colors',
        'hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        !notification.read ? 'bg-accent/30' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="mt-0.5">
        <NotificationIcon type={notification.type} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={[
            'truncate text-sm text-foreground',
            !notification.read ? 'font-semibold' : 'font-normal',
          ].join(' ')}
        >
          {notification.title}
        </span>
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {notification.body}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {relativeTime(notification.createdAt)}
        </span>
        {!notification.read && (
          <span
            aria-hidden
            className="size-2 bg-primary"
          />
        )}
      </span>
    </button>
  )
}

// ─── Panel content ────────────────────────────────────────────────────────────

function NotificationPanelContent({ onClose }: { onClose: () => void }) {
  const t = useTranslations('app.notifications')
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const router = useRouter()
  const params = useParams()
  const locale = (params.locale as string) ?? 'en'

  const displayList = notifications.slice(0, 10)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">
          {t('popoverTitle')}
        </span>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t('markAllRead')}
            </button>
          )}
          {/* Mobile close button — hidden on desktop via CSS */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="flex size-7 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Notification list */}
      <div className="flex-1 overflow-y-auto">
        {displayList.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <BellIcon className="size-8 text-muted-foreground/50" />
            <span className="text-sm text-muted-foreground">{t('empty')}</span>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-border">
            {displayList.map((n) => (
              <li key={n._id}>
                <NotificationRow notification={n} onClose={onClose} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={() => {
            router.push(`/${locale}/notifications`)
            onClose()
          }}
          className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('seeAll')} →
        </button>
      </div>
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

interface NotificationPopoverProps {
  open: boolean
  onClose: () => void
  /**
   * Ref forwarded from the trigger button so we can position the desktop
   * panel next to the bell. Only used on desktop (> md).
   */
  triggerRef?: React.RefObject<HTMLButtonElement | null>
}

export function NotificationPopover({
  open,
  onClose,
}: NotificationPopoverProps) {
  const { state } = useSidebar()
  // In RTL the sidebar is anchored to the right, so the panel must sit just
  // inside its inner (left) edge — anchor with `right` and slide from the right.
  const isRtl = useLocale() === 'ar'
  const offset =
    state === 'collapsed'
      ? 'calc(var(--sidebar-width-icon, 4rem) + 1px)'
      : 'calc(var(--sidebar-width, 16rem) + 1px)'
  const anchorStyle = isRtl ? { right: offset } : { left: offset }

  if (!open) return null

  return (
    <>
      {/* Mobile: full-screen overlay */}
      <div className="fixed inset-0 z-[9999] flex flex-col bg-background md:hidden">
        <NotificationPanelContent onClose={onClose} />
      </div>

      {/* Desktop: full-height side panel anchored to the right edge of the sidebar.
          left tracks the actual sidebar state so it works for both expanded and collapsed.
          --sidebar-width and --sidebar-width-icon are set by SidebarProvider as inline CSS vars
          and are accessible from fixed descendants via CSS custom property inheritance. */}
      <div
        role="dialog"
        aria-label="Notifications"
        style={anchorStyle as React.CSSProperties}
        className={[
          'fixed z-[9998] hidden md:flex',
          'top-0',
          'h-svh w-[360px] flex-col',
          'border border-border bg-background',
          'animate-in fade-in-0 duration-150',
          isRtl ? 'slide-in-from-right-2' : 'slide-in-from-left-2',
        ].join(' ')}
      >
        <NotificationPanelContent onClose={onClose} />
      </div>

      {/* Desktop backdrop — click outside closes */}
      <div
        aria-hidden
        className="fixed inset-0 z-[9997] hidden md:block"
        onClick={onClose}
      />
    </>
  )
}
