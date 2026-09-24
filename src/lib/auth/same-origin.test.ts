import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/config', () => ({ getConfig: () => ({ APP_URL: 'https://secrets.example.com' }) }))
const { isSameOrigin } = await import('./same-origin')

const req = (headers: Record<string, string>) =>
  new Request('https://secrets.example.com/api/auth/logout', { method: 'POST', headers })

describe('isSameOrigin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('trusts Sec-Fetch-Site when present', () => {
    expect(isSameOrigin(req({ 'sec-fetch-site': 'same-origin' }))).toBe(true)
    expect(
      isSameOrigin(req({ 'sec-fetch-site': 'cross-site', origin: 'https://secrets.example.com' })),
    ).toBe(false)
    expect(isSameOrigin(req({ 'sec-fetch-site': 'same-site' }))).toBe(false)
  })

  it('falls back to Origin, and rejects when neither header is present', () => {
    expect(isSameOrigin(req({ origin: 'https://secrets.example.com' }))).toBe(true)
    expect(isSameOrigin(req({ origin: 'https://evil.example.com' }))).toBe(false)
    expect(isSameOrigin(req({}))).toBe(false)
  })
})
