import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
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

const mockLiveArrivalTick = { value: 0 }
vi.mock('@/lib/hooks/useNotifications', () => ({
  useNotifications: () => ({ liveArrivalTick: mockLiveArrivalTick.value }),
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

  it('renders unread title and body in white text, and read items in default text colors', () => {
    renderWithProviders(
      <NotificationsListPage
        initialItems={[
          makeItem({ _id: 'unread1', title: 'Unread title', body: 'Unread body' }),
          makeItem({
            _id: 'read1',
            title: 'Read title',
            body: 'Read body',
            read: true,
            readAt: new Date().toISOString(),
          }),
        ]}
        initialNextCursor={null}
        locale="en"
        messages={MESSAGES}
      />,
    )

    // Unread rows use accent-foreground (not a hardcoded white), since the
    // unread background (bg-accent) is light in light mode and dark in dark
    // mode — a literal text-white would be invisible in light mode.
    expect(screen.getByText('Unread title').className).toContain('text-accent-foreground')
    expect(screen.getByText('Unread body').className).toContain('text-accent-foreground')
    expect(screen.getByText('Read title').className).not.toContain('text-accent-foreground')
    expect(screen.getByText('Read body').className).not.toContain('text-accent-foreground')
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

describe('NotificationsListPage — Mark all read pending state', () => {
  it('disables the button while the mark-all-read call is in flight', async () => {
    const { markAllNotificationsReadAction } = await import(
      '@/app/[locale]/(app)/notifications/_actions',
    )
    let resolveAction: () => void = () => {}
    vi.mocked(markAllNotificationsReadAction).mockReturnValue(
      new Promise<{ error?: string }>((resolve) => {
        resolveAction = () => resolve({})
      }),
    )

    renderWithProviders(
      <NotificationsListPage
        initialItems={[makeItem()]}
        initialNextCursor={null}
        locale="en"
        messages={MESSAGES}
      />,
    )

    const btn = screen.getByRole('button', { name: MESSAGES.markAllRead })
    fireEvent.click(btn)
    expect(btn).toBeDisabled()

    await act(async () => {
      resolveAction()
      await Promise.resolve()
    })
  })
})

describe('NotificationsListPage live arrival toast', () => {
  beforeEach(() => {
    mockLiveArrivalTick.value = 0
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a bundled toast beside the page title after a live arrival burst, then auto-hides it', () => {
    const { rerender } = renderWithProviders(
      <NotificationsListPage
        initialItems={[]}
        initialNextCursor={null}
        locale="en"
        messages={MESSAGES}
      />,
    )

    mockLiveArrivalTick.value = 1
    act(() => {
      rerender(
        <NotificationsListPage
          initialItems={[]}
          initialNextCursor={null}
          locale="en"
          messages={MESSAGES}
        />,
      )
    })

    expect(screen.getByText(/you have a new notification/i)).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(screen.queryByText(/new notification/i)).toBeNull()
  })
})
