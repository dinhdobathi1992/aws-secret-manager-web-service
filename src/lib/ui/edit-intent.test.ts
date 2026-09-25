import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { markEditIntent, takeEditIntent } from './edit-intent'

describe('edit intent', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  it('is taken once, for the same secret', () => {
    markEditIntent('dev', 'team/db')
    expect(takeEditIntent('dev', 'team/db')).toBe(true)
    expect(takeEditIntent('dev', 'team/db')).toBe(false)
  })
  it('a crafted link without an intent does nothing', () => {
    expect(takeEditIntent('dev', 'team/db')).toBe(false)
  })
  it('does not carry over to another secret or account, and is cleared', () => {
    markEditIntent('dev', 'team/db')
    expect(takeEditIntent('dev', 'team/other')).toBe(false)
    markEditIntent('dev', 'team/db')
    expect(takeEditIntent('prod', 'team/db')).toBe(false)
    expect(takeEditIntent('dev', 'team/db')).toBe(false)
  })
  it('expires after a minute', () => {
    vi.useFakeTimers()
    markEditIntent('dev', 'team/db')
    vi.advanceTimersByTime(61_000)
    expect(takeEditIntent('dev', 'team/db')).toBe(false)
  })
  it('rejects tampered storage', () => {
    sessionStorage.setItem('secrets-console.edit-intent', '{"accountId":"dev"}')
    expect(takeEditIntent('dev', 'team/db')).toBe(false)
  })
})

describe('edit intent with storage blocked', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('never auto-views', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    markEditIntent('dev', 'team/db')
    expect(takeEditIntent('dev', 'team/db')).toBe(false)
  })
})
