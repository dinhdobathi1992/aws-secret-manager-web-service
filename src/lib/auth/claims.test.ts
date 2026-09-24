import { sealData, unsealData } from 'iron-session'
import { describe, expect, it, vi } from 'vitest'
import { LoginError, sessionFromClaims } from './claims'
import { gid, testAccount } from './test-fixtures'

const PASSWORD = 'p'.repeat(48)
const base = { oid: '0f1e2d3c-0000-0000-0000-000000000001', tid: 'tenant', sub: 'pairwise-sub' }

describe('sessionFromClaims', () => {
  it('uses oid (not sub) and resolves roles, dropping raw groups', () => {
    const s = sessionFromClaims(
      { ...base, name: 'Ann', preferred_username: 'ann@example.com', groups: [gid(1, 2)] },
      [testAccount('dev', 1), testAccount('prod', 2)],
      0,
    )
    expect(s.oid).toBe(base.oid)
    expect(s.upn).toBe('ann@example.com')
    expect(s.roles).toEqual({ dev: 'writer' })
    expect(s.exp).toBe(3600)
    expect(JSON.stringify(s)).not.toContain(gid(1, 2))
  })

  it('prefers the upn claim when present', () => {
    const s = sessionFromClaims({ ...base, upn: 'u@x', preferred_username: 'p@x' }, [])
    expect(s.upn).toBe('u@x')
  })

  it('rejects groups overage', () => {
    for (const claims of [
      { ...base, _claim_names: { groups: 'src1' } },
      { ...base, hasgroups: true },
    ]) {
      expect(() => sessionFromClaims(claims, [])).toThrow(LoginError)
    }
  })

  it('rejects a token without oid', () => {
    expect(() => sessionFromClaims({ tid: 't' }, [])).toThrow(LoginError)
  })

  it('keeps the sealed cookie under 2 KB for a user in 150 groups across 20 accounts', async () => {
    const accounts = Array.from({ length: 20 }, (_, i) => testAccount(`account-${i}`, i + 1))
    const groups = [
      ...accounts.map((_, i) => gid(i + 1, 3)),
      ...Array.from(
        { length: 130 },
        (_, i) => `aaaaaaaa-0000-0000-0000-${String(i).padStart(12, '0')}`,
      ),
    ]
    expect(groups).toHaveLength(150)
    const s = sessionFromClaims(
      { ...base, name: 'Someone With A Long Name', upn: 'someone.long@example.com', groups },
      accounts,
    )
    expect(Object.keys(s.roles)).toHaveLength(20)
    const sealed = await sealData(s, { password: PASSWORD, ttl: 3600 })
    expect(sealed.length).toBeLessThan(2048)
  })

  it('a tampered, foreign or expired seal yields an empty session', async () => {
    const s = sessionFromClaims({ ...base, groups: [] }, [])
    const sealed = await sealData(s, { password: PASSWORD, ttl: 3600 })
    const tampered = sealed.slice(0, -4) + (sealed.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(await unsealData(tampered, { password: PASSWORD, ttl: 3600 })).toEqual({})
    expect(await unsealData(sealed, { password: 'q'.repeat(48), ttl: 3600 })).toEqual({})
    vi.useFakeTimers({ now: Date.now() + 2 * 3600 * 1000 })
    try {
      expect(await unsealData(sealed, { password: PASSWORD, ttl: 3600 })).toEqual({})
    } finally {
      vi.useRealTimers()
    }
  })
})
