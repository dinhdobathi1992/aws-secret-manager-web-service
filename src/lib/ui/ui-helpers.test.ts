import { describe, expect, it } from 'vitest'
import {
  absoluteDate,
  deletionEstimate,
  freshness,
  relativeTime,
  secretHref,
  shortAccountId,
  shortVersion,
  secretNameFromSegments,
  splitName,
} from './format'
import { hasChanges, keyDiff } from './key-diff'
import { diffEntries, serialize, toModel } from './secret-value'

const NOW = Date.parse('2026-09-24T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const DAY = 86_400_000

describe('format', () => {
  it('relative time', () => {
    expect(relativeTime(ago(30_000), NOW)).toBe('just now')
    expect(relativeTime(ago(2 * DAY), NOW)).toBe('2 days ago')
    expect(relativeTime(ago(21 * DAY), NOW)).toBe('3 weeks ago')
    expect(relativeTime(ago(40 * DAY), NOW)).toBe('1 month ago')
    expect(relativeTime(undefined, NOW)).toBe('—')
  })

  it('freshness buckets', () => {
    expect(freshness(ago(2 * DAY), NOW)).toBe('week')
    expect(freshness(ago(60 * DAY), NOW)).toBe('quarter')
    expect(freshness(ago(120 * DAY), NOW)).toBe('stale')
  })

  it('absolute date in UTC', () => {
    expect(absoluteDate('2026-09-22T14:08:00Z', true)).toBe('Sep 22, 2026, 14:08')
  })

  it('splits names and encodes hrefs per segment', () => {
    expect(splitName('team/app/db')).toEqual({ path: 'team/app/', leaf: 'db', top: 'team' })
    expect(splitName('flat')).toEqual({ path: '', leaf: 'flat', top: 'flat' })
    expect(secretHref('dev', 'odd/name+with=chars@x')).toBe('/a/dev/s/odd/name%2Bwith%3Dchars%40x')
    expect(secretHref('dev', 'a/b', 'versions')).toBe('/a/dev/s/a/b?tab=versions')
  })

  it('decodes catch-all segments back to the secret name', () => {
    const href = secretHref('dev', 'odd/name+with=chars@x')
    const segs = href.split('/s/')[1].split('/')
    expect(secretNameFromSegments(segs)).toBe('odd/name+with=chars@x')
    expect(secretNameFromSegments(['bad%E0%A4%A'])).toBeNull()
  })

  it('estimates permanent deletion from the request time (real AWS semantics)', () => {
    const requested = new Date(NOW).toISOString()
    expect(deletionEstimate(requested, 30, NOW)).toEqual({
      deletesAt: new Date(NOW + 30 * DAY).toISOString(),
      daysLeft: 30,
    })
    expect(deletionEstimate(ago(40 * DAY), 30, NOW)?.daysLeft).toBe(0)
    expect(deletionEstimate(undefined, 30, NOW)).toBeNull()
  })

  it('shortens ids', () => {
    expect(shortAccountId('arn:aws:iam::123456789012:role/x')).toBe('1234…9012')
    expect(shortVersion('3f9c1d2e-0000-0000-0000-00000000a1e2')).toBe('3f9c…a1e2')
  })
})

describe('keyDiff', () => {
  it('reports key names only', () => {
    const d = keyDiff({ a: '1', b: '2', c: '3' }, { a: '1', b: 'x', d: '4' })
    expect(d).toEqual({ added: ['d'], removed: ['c'], changed: ['b'], same: ['a'] })
    expect(JSON.stringify(d)).not.toContain('x')
    expect(hasChanges(d)).toBe(true)
    expect(hasChanges(keyDiff({ a: '1' }, { a: '1' }))).toBe(false)
  })

  it('treats inherited property names as ordinary keys', () => {
    expect(keyDiff({}, { constructor: 'v' }).added).toEqual(['constructor'])
  })
})

describe('value model', () => {
  it('classifies values', () => {
    expect(toModel('{"a":"1"}', 'string')).toEqual({ kind: 'kv', entries: { a: '1' } })
    expect(toModel('{"a":1}', 'string').kind).toBe('json')
    expect(toModel('plain {not json', 'string').kind).toBe('text')
    expect(toModel('AQID', 'binary')).toEqual({ kind: 'binary', base64: 'AQID' })
  })

  it('round-trips and diffs', () => {
    expect(serialize({ kind: 'kv', entries: { a: '1' } })).toBe('{"a":"1"}')
    expect(diffEntries({ kind: 'text', text: 't' })).toEqual({ '(value)': 't' })
  })
})
