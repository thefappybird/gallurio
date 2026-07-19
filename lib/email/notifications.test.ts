import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock server-only so it doesn't throw in the test environment
vi.mock('server-only', () => ({}))

// Capture sendEmail calls without hitting the network
const mockSendEmail = vi.fn().mockResolvedValue({ ok: true, id: 'test-id' })
vi.mock('./send', () => ({ sendEmail: mockSendEmail }))

// Import after mocks are set up
const { sendNotificationEmail } = await import('./notifications')

describe('sendNotificationEmail', () => {
  beforeEach(() => {
    mockSendEmail.mockClear()
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.gallurio.com'
  })

  it('renders title and body in html for a team type', async () => {
    await sendNotificationEmail({
      recipient: { email: 'user@example.com' },
      title: 'You have been invited to a team',
      body: 'Alex invited you to join the Photography team.',
      href: '/settings/teams',
      type: 'team.invitation',
    })

    expect(mockSendEmail).toHaveBeenCalledOnce()
    const call = mockSendEmail.mock.calls[0][0]
    expect(call.html).toContain('You have been invited to a team')
    expect(call.html).toContain('Alex invited you to join the Photography team.')
    expect(call.html).toContain('https://app.gallurio.com/settings/teams')
  })

  it('uses title as subject for a team type', async () => {
    await sendNotificationEmail({
      recipient: { email: 'user@example.com' },
      title: 'You have been removed from a team',
      body: 'You were removed from the Photography team.',
      href: '/settings/teams',
      type: 'team.removed',
    })

    const call = mockSendEmail.mock.calls[0][0]
    expect(call.subject).toBe('You have been removed from a team')
  })

  it('uses generic subject for a non-team type', async () => {
    await sendNotificationEmail({
      recipient: { email: 'user@example.com' },
      title: 'Booking confirmed',
      body: 'Your booking for Saturday has been confirmed.',
      href: '/bookings/abc123',
      type: 'booking.status_changed',
    })

    const call = mockSendEmail.mock.calls[0][0]
    expect(call.subject).toBe('New notification — Gallurio')
  })

  it('renders title, body, and deep-link href for a non-team type', async () => {
    await sendNotificationEmail({
      recipient: { email: 'user@example.com' },
      title: 'Booking status updated',
      body: 'Your booking status has changed to confirmed.',
      href: '/bookings/abc123',
      type: 'booking.status_changed',
    })

    const call = mockSendEmail.mock.calls[0][0]
    expect(call.html).toContain('Booking status updated')
    expect(call.html).toContain('Your booking status has changed to confirmed.')
    expect(call.html).toContain('https://app.gallurio.com/bookings/abc123')
  })

  it('omits CTA and renders fallback p when NEXT_PUBLIC_APP_URL is unset', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL

    await sendNotificationEmail({
      recipient: { email: 'user@example.com' },
      title: 'Team deleted',
      body: 'The Photography team has been deleted.',
      href: '/settings/teams',
      type: 'team.deleted',
    })

    const call = mockSendEmail.mock.calls[0][0]
    // No CTA button href — the href should not appear
    expect(call.html).not.toContain('href="https://')
    // Fallback message present
    expect(call.html).toContain('Open the app to view this notification.')
  })

  it('never throws even if sendEmail rejects', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('transport error'))

    await expect(
      sendNotificationEmail({
        recipient: { email: 'user@example.com' },
        title: 'Test',
        body: 'Test body.',
        href: '/test',
        type: 'inquiry.created',
      }),
    ).resolves.toBeUndefined()
  })
})
