import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatRelativeTime } from './relativeTime'

const NOW = new Date('2024-06-15T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('formatRelativeTime', () => {
  it('returns "now" for 0 seconds ago (en)', () => {
    const result = formatRelativeTime(NOW, 'en')
    expect(result).toBe('now')
  })

  it('returns relative seconds for 30s ago (en)', () => {
    const date = new Date(NOW.getTime() - 30_000)
    expect(formatRelativeTime(date, 'en')).toMatch(/30 second/)
  })

  it('returns Arabic-script output for 30s ago (ar)', () => {
    const date = new Date(NOW.getTime() - 30_000)
    const result = formatRelativeTime(date, 'ar')
    expect(result).toMatch(/[؀-ۿ]/)
  })

  it('returns relative minutes for 15m ago (en)', () => {
    const date = new Date(NOW.getTime() - 15 * 60_000)
    expect(formatRelativeTime(date, 'en')).toMatch(/15 minute/)
  })

  it('returns relative hours for 3h ago (en)', () => {
    const date = new Date(NOW.getTime() - 3 * 60 * 60_000)
    expect(formatRelativeTime(date, 'en')).toMatch(/3 hour/)
  })

  it('returns relative days for 2d ago (en)', () => {
    const date = new Date(NOW.getTime() - 2 * 24 * 60 * 60_000)
    expect(formatRelativeTime(date, 'en')).toMatch(/2 day/)
  })

  it('returns localized short date for 14d ago (en)', () => {
    const date = new Date('2024-06-01T12:00:00Z') // 14d before NOW
    expect(formatRelativeTime(date, 'en')).toBe('Jun 1')
  })

  it('returns a non-empty localized date string for 14d ago (ar)', () => {
    const date = new Date('2024-06-01T12:00:00Z')
    const result = formatRelativeTime(date, 'ar')
    expect(result.length).toBeGreaterThan(0)
  })

  it('accepts an ISO string input', () => {
    const iso = new Date(NOW.getTime() - 15 * 60_000).toISOString()
    expect(formatRelativeTime(iso, 'en')).toMatch(/15 minute/)
  })
})
