/**
 * Locale-aware relative time formatter using Intl.RelativeTimeFormat.
 *
 * Buckets:
 *  < 60 s  → relative seconds (Intl; gives "now" for 0 s with numeric:'auto')
 *  < 60 m  → relative minutes
 *  < 24 h  → relative hours
 *  < 7 d   → relative days
 *  ≥ 7 d   → short locale date, e.g. "Jun 1"
 */
export function formatRelativeTime(date: Date | string, locale: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const seconds = Math.floor(diffMs / 1000)

  if (seconds < 60) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-seconds, 'second')
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-minutes, 'minute')
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-hours, 'hour')
  }

  const days = Math.floor(hours / 24)
  if (days < 7) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-days, 'day')
  }

  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}
