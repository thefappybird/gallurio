import { describe, expect, it, vi } from 'vitest'
import { createTranslator } from 'next-intl'
import enMessagesRaw from '@/messages/en.json'

// Stub server-only getTranslations — ICU resolution is tested directly via
// createTranslator (pure function, no Next.js request context needed).
// The buildNotificationContent integration test below also mocks getTranslations
// to verify that vars are forwarded to the title (the line-26 change).

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(),
}))

import { getTranslations } from 'next-intl/server'
import { buildNotificationContent } from './messages'

// ---------------------------------------------------------------------------
// Build a loosely-typed translator for app.notifications from real en.json.
// We cast away the strict JSON-literal key inference because the ICU select
// strings in the JSON confuse TS's template-literal key extraction.
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const enMessages = enMessagesRaw as unknown as Record<string, any>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeT(): (key: string, vars?: Record<string, unknown>) => string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createTranslator({
    locale: 'en',
    namespace: 'app.notifications',
    messages: enMessages,
  }) as unknown as (key: string, vars?: Record<string, unknown>) => string
}

describe('booking.status_changed ICU select — title', () => {
  it('title is "Booking cancelled" when newStatus=cancelled', () => {
    const t = makeT()
    const title = t('types.booking.status_changed.title', { newStatus: 'cancelled' })
    expect(title).toBe('Booking cancelled')
  })

  it('title is "Booking completed" when newStatus=completed', () => {
    const t = makeT()
    const title = t('types.booking.status_changed.title', { newStatus: 'completed' })
    expect(title).toBe('Booking completed')
  })

  it('title is "Booking confirmed" when newStatus=booked', () => {
    const t = makeT()
    const title = t('types.booking.status_changed.title', { newStatus: 'booked' })
    expect(title).toBe('Booking confirmed')
  })

  it('title falls back to "Booking status updated" for unknown status', () => {
    const t = makeT()
    const title = t('types.booking.status_changed.title', { newStatus: 'rescheduled' })
    expect(title).toBe('Booking status updated')
  })
})

describe('booking.status_changed ICU select — body', () => {
  it('body mentions actor and cancelled for newStatus=cancelled', () => {
    const t = makeT()
    const body = t('types.booking.status_changed.body', { newStatus: 'cancelled', actorName: 'Alex' })
    expect(body).toContain('Alex')
    expect(body.toLowerCase()).toContain('cancel')
  })

  it('body mentions actor and completed for newStatus=completed', () => {
    const t = makeT()
    const body = t('types.booking.status_changed.body', { newStatus: 'completed', actorName: 'Alex' })
    expect(body).toContain('Alex')
    expect(body.toLowerCase()).toContain('complet')
  })
})

describe('buildNotificationContent passes vars to title (line-26 coverage)', () => {
  it('calls getTranslations and forwards vars to title resolution', async () => {
    const mockT = vi.fn((key: string, vars?: Record<string, string>) => {
      if (key === 'types.booking.status_changed.title') return `title:${vars?.newStatus ?? ''}`
      if (key === 'types.booking.status_changed.body') return `body:${vars?.actorName ?? ''}`
      return ''
    })
    ;(getTranslations as ReturnType<typeof vi.fn>).mockResolvedValue(mockT)

    const result = await buildNotificationContent(
      'booking.status_changed',
      'en',
      'entity-id',
      'booking',
      { newStatus: 'cancelled', actorName: 'Alex' },
    )

    // Title must have received vars — the mock returns 'title:cancelled'
    expect(result.title).toBe('title:cancelled')
    expect(result.body).toBe('body:Alex')
  })
})

describe('team.invite_accepted notification', () => {
  it('describes the accepted role and deep-links to the matching active member', async () => {
    ;(getTranslations as ReturnType<typeof vi.fn>).mockResolvedValue(makeT())

    const result = await buildNotificationContent(
      'team.invite_accepted',
      'en',
      'team-id',
      'team',
      {
        memberName: 'Alex',
        memberEmail: 'alex@example.com',
        role: 'staff',
        teamName: 'Wedding crew',
      },
    )

    expect(result.title).toBe('Alex accepted your invitation')
    expect(result.body).toContain('staff member')
    expect(result.body).toContain('Wedding crew')
    expect(result.href).toBe('/en/teams?members=active&member=alex%40example.com')
  })
})
