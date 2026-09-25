import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testAccount } from '@/lib/auth/test-fixtures'

const providerCalls: Array<{ params: Record<string, unknown>; clientConfig?: unknown }> = []
vi.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: () => async () => ({ accessKeyId: 'base', secretAccessKey: 'base' }),
  fromTemporaryCredentials: (opts: { params: Record<string, unknown>; clientConfig?: unknown }) => {
    providerCalls.push(opts)
    return async () => ({ accessKeyId: 'x', secretAccessKey: 'y' })
  },
}))

const {
  assumeRoleParams,
  clearClientCache,
  clientCacheSize,
  secretsClientFor,
  sourceIdentityFor,
  stsSafe,
} = await import('./assume-role')
const { apiActionsFor, TIER_SESSION_POLICY } = await import('./session-policies')

const dev = testAccount('dev', 1)
const prod = testAccount('prod', 2)
const ann = { oid: '11111111-aaaa-bbbb-cccc-000000000001', upn: 'ann@example.com' }
const bob = { oid: '22222222-aaaa-bbbb-cccc-000000000002', upn: 'bob@example.com' }

describe('assumeRoleParams', () => {
  it('passes the account roleArn, the tier session policy and the user as SourceIdentity', () => {
    const p = assumeRoleParams({ account: prod, user: ann, role: 'writer' })
    expect(p.RoleArn).toBe(prod.roleArn)
    expect(p.RoleSessionName).toBe(`sc-${ann.oid}`)
    expect(p.SourceIdentity).toBe('ann@example.com')
    expect(p.Policy).toBe(TIER_SESSION_POLICY.writer)
  })

  it('sanitises session name and source identity to STS rules', () => {
    expect(stsSafe('José Ñ/x y')).toMatch(/^[\w+=,.@-]+$/)
    expect(stsSafe('a'.repeat(100))).toHaveLength(64)
    expect(stsSafe('a')).toHaveLength(2)
  })

  it('keeps valid UPNs and hashes the rest so different users never collide', () => {
    expect(sourceIdentityFor('ann@example.com')).toBe('ann@example.com')
    const guestA = 'someone.with.a.long.name_example.com#EXT#@contosotenant.onmicrosoft.com'
    const guestB = 'someone.with.a.long.name_example.org#EXT#@contosotenant.onmicrosoft.com'
    const a = sourceIdentityFor(guestA)
    expect(a).toMatch(/^[\w+=,.@-]{2,64}$/)
    expect(a).not.toBe(sourceIdentityFor(guestB))
    expect(sourceIdentityFor(guestA)).toBe(a)
  })
})

describe('session policies', () => {
  it('reader can read but not write', () => {
    const reader = apiActionsFor('reader')
    expect(reader).toEqual(
      expect.arrayContaining([
        'secretsmanager:ListSecrets',
        'secretsmanager:DescribeSecret',
        'secretsmanager:GetSecretValue',
        'secretsmanager:ListSecretVersionIds',
      ]),
    )
    expect(reader).not.toContain('secretsmanager:PutSecretValue')
    expect(reader).not.toContain('secretsmanager:TagResource')
  })

  it('writer adds create/update/tag, admin adds delete/restore/rollback', () => {
    const writer = apiActionsFor('writer')
    expect(writer).toEqual(
      expect.arrayContaining([
        'secretsmanager:CreateSecret',
        'secretsmanager:PutSecretValue',
        'secretsmanager:TagResource',
        'secretsmanager:UntagResource',
      ]),
    )
    expect(writer).not.toContain('secretsmanager:DeleteSecret')
    expect(apiActionsFor('admin')).toEqual(
      expect.arrayContaining([
        'secretsmanager:DeleteSecret',
        'secretsmanager:RestoreSecret',
        'secretsmanager:UpdateSecretVersionStage',
      ]),
    )
  })

  it('fits the STS packed policy limit and only allows KMS via Secrets Manager', () => {
    for (const policy of Object.values(TIER_SESSION_POLICY)) {
      expect(policy.length).toBeLessThan(2048)
      expect(policy).toContain('kms:ViaService')
    }
    expect(TIER_SESSION_POLICY.reader).not.toContain('kms:GenerateDataKey')
  })
})

describe('secretsClientFor (account isolation)', () => {
  beforeEach(() => {
    providerCalls.length = 0
    clearClientCache()
  })
  afterEach(() => clearClientCache())

  it('reuses a client for the same (account, user, tier)', () => {
    const a = secretsClientFor({ account: dev, user: ann, role: 'reader' })
    const b = secretsClientFor({ account: dev, user: ann, role: 'reader' })
    expect(a).toBe(b)
    expect(providerCalls).toHaveLength(1)
  })

  it('never shares a client across users, tiers or accounts', () => {
    const clients = [
      secretsClientFor({ account: dev, user: ann, role: 'reader' }),
      secretsClientFor({ account: dev, user: bob, role: 'reader' }),
      secretsClientFor({ account: dev, user: ann, role: 'admin' }),
      secretsClientFor({ account: prod, user: ann, role: 'reader' }),
    ]
    expect(new Set(clients).size).toBe(4)
    expect(providerCalls.map((c) => c.params.RoleArn)).toEqual([
      dev.roleArn,
      dev.roleArn,
      dev.roleArn,
      prod.roleArn,
    ])
    expect(providerCalls.map((c) => c.params.SourceIdentity)).toEqual([
      ann.upn,
      bob.upn,
      ann.upn,
      ann.upn,
    ])
    expect(providerCalls[2].params.Policy).toBe(TIER_SESSION_POLICY.admin)
    expect(providerCalls[3].clientConfig).toEqual({ region: prod.region })
  })

  it('caps the cache and evicts the least recently used entry', () => {
    const scope = (i: number) => ({
      account: dev,
      user: { oid: `u${i}`, upn: `u${i}@x` },
      role: 'reader' as const,
    })
    const first = secretsClientFor(scope(0))
    for (let i = 1; i < 200; i++) secretsClientFor(scope(i))
    expect(secretsClientFor(scope(0))).toBe(first) // touch: now most recent
    for (let i = 200; i < 205; i++) secretsClientFor(scope(i))
    expect(clientCacheSize()).toBe(200)
    expect(secretsClientFor(scope(0))).toBe(first) // survived eviction
    const calls = providerCalls.length
    secretsClientFor(scope(1)) // was least recent, so it was evicted and is rebuilt
    expect(providerCalls.length).toBe(calls + 1)
  })

  it('shares one base identity across all clients', () => {
    secretsClientFor({ account: dev, user: ann, role: 'reader' })
    secretsClientFor({ account: prod, user: bob, role: 'admin' })
    const bases = providerCalls.map((c) => (c as { masterCredentials?: unknown }).masterCredentials)
    expect(bases[0]).toBeDefined()
    expect(bases[0]).toBe(bases[1])
  })
})
