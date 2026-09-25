import { describe, expect, it } from 'vitest'
import type { ActivityEvent } from '@/lib/aws/activity'
import {
  activityWindow,
  groupActivity,
  matchesText,
  matchesType,
  parseActivityType,
} from './activity-options'

const filterActivity = (
  events: ActivityEvent[],
  f: { type: string; user?: string; secret?: string },
) =>
  events.filter(
    (e) => matchesType(e, parseActivityType(f.type)) && matchesText(e, f.user, f.secret),
  )

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
  it('writes: changes and failures, no reveals or reads', () =>
    expect(ids(filterActivity(E, { type: 'writes' }))).toEqual(['c', 'f']))
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

describe('groupActivity', () => {
  const ev = (id: string, time: string, extra: Partial<ActivityEvent> = {}): ActivityEvent => ({
    id,
    time,
    eventName: 'GetSecretValue',
    label: 'View',
    kind: 'reveal',
    who: 'ann@example.com',
    viaApp: true,
    secretName: 'team/db',
    ...extra,
  })

  it('collapses consecutive repeats in the same minute', () => {
    const days = groupActivity([
      ev('a', '2026-09-24T17:59:40Z'),
      ev('b', '2026-09-24T17:59:10Z'),
      ev('c', '2026-09-24T17:59:01Z'),
    ])
    expect(days).toHaveLength(1)
    expect(days[0].total).toBe(3)
    expect(days[0].rows).toEqual([{ e: expect.objectContaining({ id: 'a' }), count: 3 }])
  })

  it('keeps rows apart across minutes, users, secrets, actions and results', () => {
    const days = groupActivity([
      ev('a', '2026-09-24T17:59:40Z'),
      ev('b', '2026-09-24T17:58:59Z'),
      ev('c', '2026-09-24T17:58:30Z', { who: 'bob@example.com' }),
      ev('d', '2026-09-24T17:58:20Z', { who: 'bob@example.com', secretName: 'other' }),
      ev('e', '2026-09-24T17:58:10Z', {
        who: 'bob@example.com',
        secretName: 'other',
        eventName: 'PutSecretValue',
      }),
      ev('f', '2026-09-24T17:58:05Z', {
        who: 'bob@example.com',
        secretName: 'other',
        eventName: 'PutSecretValue',
        errorCode: 'AccessDenied',
      }),
    ])
    expect(days[0].rows.map((r) => r.count)).toEqual([1, 1, 1, 1, 1, 1])
  })

  it('never collapses a repeat that is not consecutive', () => {
    const days = groupActivity([
      ev('a', '2026-09-24T17:59:40Z'),
      ev('b', '2026-09-24T17:59:30Z', { who: 'bob@example.com' }),
      ev('c', '2026-09-24T17:59:20Z'),
    ])
    expect(days[0].rows).toHaveLength(3)
  })

  it('starts a new day header at UTC midnight and counts events per day', () => {
    const days = groupActivity([
      ev('a', '2026-09-25T00:00:10Z'),
      ev('b', '2026-09-24T23:59:50Z'),
      ev('c', '2026-09-24T23:59:40Z'),
    ])
    expect(days.map((d) => [d.day, d.total, d.rows.length])).toEqual([
      ['Friday, Sep 25, 2026', 1, 1],
      ['Thursday, Sep 24, 2026', 2, 1],
    ])
  })
})
