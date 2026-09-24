import { describe, expect, it } from 'vitest'
import { entriesFrom, newRow, tagChanges } from './editor-model'
import { secretHref, secretNameFromSegments } from './format'

describe('entriesFrom', () => {
  it('keeps keys exactly, including whitespace and __proto__', () => {
    const r = entriesFrom([newRow(' a', '1'), newRow('__proto__', '2'), newRow('b ', '3')])
    expect(r.ok && Object.keys(r.entries)).toEqual([' a', '__proto__', 'b '])
    expect(r.ok && JSON.stringify(r.entries)).toBe('{" a":"1","__proto__":"2","b ":"3"}')
  })

  it('rejects blank and duplicate keys', () => {
    expect(entriesFrom([newRow('  ', 'x')]).ok).toBe(false)
    expect(entriesFrom([newRow('a', '1'), newRow('a', '2')]).ok).toBe(false)
  })
})

describe('tagChanges', () => {
  it('reports only real changes and keeps values as typed', () => {
    const orig = { team: 'platform', env: 'dev ' }
    const r = tagChanges(orig, [
      newRow('team', 'platform'),
      newRow('env', 'dev '),
      newRow('owner', 'x'),
    ])
    expect(r).toEqual({ ok: true, set: { owner: 'x' }, remove: [] })
  })

  it('removes dropped keys, keeps __proto__ and rejects aws: in any case', () => {
    expect(tagChanges({ a: '1', __proto__x: '2' }, [newRow('a', '1')])).toEqual({
      ok: true,
      set: {},
      remove: ['__proto__x'],
    })
    const proto = tagChanges({}, [newRow('__proto__', 'v')])
    expect(proto.ok && Object.keys(proto.set)).toEqual(['__proto__'])
    expect(tagChanges({}, [newRow('AWS:x', 'y')]).ok).toBe(false)
  })
})

describe('secretHref round-trip', () => {
  const names = [
    'team/app/db',
    'odd/name+with=chars@x',
    'x/../prod/db',
    'a/./b',
    'a//b',
    '/lead',
    'trail/',
    '..',
  ]
  it.each(names)('%s', (name) => {
    const href = secretHref('dev', name)
    const url = new URL(href, 'http://h') // what a browser does, including dot-segment resolution
    const segs = url.pathname.split('/s/')[1].split('/')
    expect(secretNameFromSegments(segs)).toBe(name)
  })
})
