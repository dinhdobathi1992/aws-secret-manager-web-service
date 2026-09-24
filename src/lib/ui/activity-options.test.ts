import { describe, expect, it } from 'vitest'
import type { ActivityEvent } from '@/lib/aws/activity'
import { activityWindow, filterActivity, parseActivityType } from './activity-options'

const ev = (over: Partial<ActivityEvent>): ActivityEvent => ({
  id: Math.random().toString(),
  time: '2026-09-25T00:00:00Z',
  eventName: 'GetSecretValue',
  label: 'Reveal',
  kind: 'reveal',
  who: 'thi@example.com',
  viaApp: true,
  secretName: 'sc-demo/app/db',
  ...over,
})

const E = [
  ev({ id: 'r' }),
  ev({
    id: 'c',
    kind: 'change',
    label: 'Update value',
    who: 'linh@example.com',
    secretName: 'billing/config',
  }),
  ev({ id: 'f', kind: 'change', errorCode: 'AccessDenied' }),
  ev({ id: 'l', kind: 'read', label: 'ListSecrets', secretName: undefined }),
]
const ids = (xs: ActivityEvent[]) => xs.map((x) => x.id)

describe('filterActivity', () => {
  it('hides list/describe by default', () =>
    expect(ids(filterActivity(E, { type: 'changes' }))).toEqual(['r', 'c', 'f']))
  it('reveals only', () => expect(ids(filterActivity(E, { type: 'reveals' }))).toEqual(['r']))
  it('failed only', () => expect(ids(filterActivity(E, { type: 'failed' }))).toEqual(['f']))
  it('all includes reads', () => expect(ids(filterActivity(E, { type: 'all' }))).toHaveLength(4))
  it('filters by user and secret, case-insensitively', () => {
    expect(ids(filterActivity(E, { type: 'all', user: 'LINH' }))).toEqual(['c'])
    expect(ids(filterActivity(E, { type: 'all', secret: 'billing' }))).toEqual(['c'])
  })
})

describe('activityWindow', () => {
  const NOW = Date.parse('2026-09-25T00:00:00Z')
  it('starts fresh without a cursor', () => {
    const w = activityWindow(NOW, 7, undefined, String(NOW - 5000))
    expect(w.end.getTime()).toBe(NOW)
    expect(w.nextToken).toBeUndefined()
  })
  it('reuses the original window with a cursor, so the NextToken stays valid', () => {
    const first = NOW - 60_000
    const w = activityWindow(NOW, 7, 'tok', String(first))
    expect(w.end.getTime()).toBe(first)
    expect(w.start.getTime()).toBe(first - 7 * 86_400_000)
    expect(w.nextToken).toBe('tok')
  })
  it('ignores a tampered or stale end', () => {
    expect(activityWindow(NOW, 7, 'tok', 'abc').nextToken).toBeUndefined()
    expect(activityWindow(NOW, 7, 'tok', String(NOW + 1)).nextToken).toBeUndefined()
    expect(activityWindow(NOW, 7, 'tok', String(NOW - 91 * 86_400_000)).nextToken).toBeUndefined()
  })
})

describe('parseActivityType', () => {
  it('defaults unknown values to changes', () => {
    expect(parseActivityType('xyz')).toBe('changes')
    expect(parseActivityType('failed')).toBe('failed')
  })
})
