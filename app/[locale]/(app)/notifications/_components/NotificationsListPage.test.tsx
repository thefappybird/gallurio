import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils/render'
import arMessages from '@/messages/ar.json'
import { NotificationsListPage } from './NotificationsListPage'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/app/[locale]/(app)/notifications/_actions', () => ({
  markNotificationReadAction: vi.fn(),
  markAllNotificationsReadAction: vi.fn(),
}))

vi.mock('@/app/[locale]/(app)/notifications/_load-more-action', () => ({
  loadMoreNotificationsAction: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
}))

const MESSAGES = {
  pageTitle: 'Notifications',
  markAllRead: 'Mark all read',
  empty: 'No notifications',
  loadMore: 'Load more',
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'n1',
    type: 'inquiry.created',
    title: 'Stored title',
    body: 'Stored body',
    href: '/en/inquiries',
    entityId: 'e1',
    entityType: 'inquiry',
    read: false,
    readAt: null,
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    ...overrides,
  }
}

describe('NotificationsListPage', () => {
  it('falls back to stored title/body when params is absent', () => {
    renderWithProviders(
      <NotificationsListPage
        initialItems={[makeItem()]}
        initialNextCursor={null}
        locale="en"
        messages={MESSAGES}
      />,
    )
    expect(screen.getByText('Stored title')).toBeTruthy()
    expect(screen.getByText('Stored body')).toBeTruthy()
  })

  it('renders translated English body when params are present (en)', () => {
    renderWithProviders(
      <NotificationsListPage
        initialItems={[makeItem({ params: { clientName: 'Alice' } })]}
        initialNextCursor={null}
        locale="en"
        messages={MESSAGES}
      />,
      { locale: 'en' },
    )
    // en body template: "You have a new inquiry from {clientName}."
    expect(screen.getByText(/Alice/)).toBeTruthy()
    expect(screen.queryByText('Stored body')).toBeNull()
  })

  it('renders translated Arabic body when locale is ar and params present', () => {
    renderWithProviders(
      <NotificationsListPage
        initialItems={[makeItem({ params: { clientName: 'أحمد' } })]}
        initialNextCursor={null}
        locale="ar"
        messages={MESSAGES}
      />,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { locale: 'ar', messages: arMessages as any },
    )
    // ar body template: "لديك استفسار جديد من {clientName}."
    expect(screen.getByText(/أحمد/)).toBeTruthy()
    expect(screen.queryByText('Stored body')).toBeNull()
  })
})
