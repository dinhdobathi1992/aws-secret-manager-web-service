import { describe, expect, it } from 'vitest'
import { applyTemplate, isMaskedKey, placeholderFor, TEMPLATES } from './secret-templates'

describe('secret templates', () => {
  it('RDS fills key names only, never values', () => {
    const rows = applyTemplate('rds', [])
    expect(rows.map((r) => r.key)).toEqual([
      'username',
      'password',
      'engine',
      'host',
      'port',
      'dbname',
    ])
    expect(rows.every((r) => r.value === '')).toBe(true)
  })
  it('keeps values typed under the same key and extra keys with a value', () => {
    const rows = applyTemplate('redshift', [
      { key: 'username', value: 'u1' },
      { key: 'extra', value: 'x' },
      { key: 'blank', value: '' },
    ])
    expect(rows.find((r) => r.key === 'username')?.value).toBe('u1')
    expect(rows.at(-1)).toEqual({ key: 'extra', value: 'x' })
    expect(rows.some((r) => r.key === 'blank')).toBe(false)
  })
  it('Other starts with one empty row', () => {
    expect(applyTemplate('other', [])).toEqual([{ key: '', value: '' }])
  })
  it('Other drops its empty row when extra keys are kept', () => {
    expect(applyTemplate('other', [{ key: 'token', value: 't' }])).toEqual([
      { key: 'token', value: 't' },
    ])
  })
  it('masks everything except known non-secret template keys', () => {
    expect(isMaskedKey('password')).toBe(true)
    expect(isMaskedKey('api_key')).toBe(true)
    expect(isMaskedKey('')).toBe(true)
    expect(isMaskedKey('Host')).toBe(false)
    expect(isMaskedKey('port')).toBe(false)
  })
  it('placeholders are examples from the template', () => {
    expect(placeholderFor('rds', 'port')).toBe('3306')
    expect(placeholderFor('other', '')).toBeUndefined()
    expect(Object.keys(TEMPLATES)).toEqual(['rds', 'docdb', 'redshift', 'other'])
  })
})
