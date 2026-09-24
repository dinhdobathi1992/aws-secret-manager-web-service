import { describe, expect, it } from 'vitest'
import { asKeyValue, safeParseJson } from './json'

describe('safeParseJson', () => {
  it('parses valid JSON', () => {
    expect(safeParseJson('{"a":"1"}')).toEqual({ ok: true, value: { a: '1' } })
  })

  it('fails without exposing the input text', () => {
    const planted = 'not-json-planted-secret-value'
    const result = safeParseJson(planted)
    expect(result).toEqual({ ok: false })
    expect(JSON.stringify(result)).not.toContain(planted)
  })
})

describe('asKeyValue', () => {
  it('accepts flat string maps only', () => {
    expect(asKeyValue({ a: '1' })).toEqual({ a: '1' })
    expect(asKeyValue({ a: 1 })).toBeNull()
    expect(asKeyValue(['a'])).toBeNull()
    expect(asKeyValue('a')).toBeNull()
  })
})
