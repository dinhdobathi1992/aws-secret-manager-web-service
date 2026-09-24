/**
 * Integration test against a moto server (run via `pnpm test:integration`, which starts moto).
 * Exercises the real SDK + AssumeRole path. moto does not enforce IAM, KMS or session policies;
 * those are covered by the mock-level tests in assume-role.test.ts.
 */
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { testAccount } from '@/lib/auth/test-fixtures'
import { clearClientCache, secretsClientFor } from './assume-role'
import { DomainError } from './errors'
import {
  createSecret,
  deleteSecret,
  describeSecret,
  getSecretValue,
  listDeleted,
  listSecrets,
  listVersions,
  putSecretValue,
  restoreSecret,
  rollbackSecret,
  updateTags,
} from './secrets'

if (!process.env.AWS_ENDPOINT_URL) {
  throw new Error('secrets.moto.test.ts needs AWS_ENDPOINT_URL (run `pnpm test:integration`)')
}

const accountA = testAccount('moto-a', 111111111111)
const accountB = testAccount('moto-b', 222222222222)
const user = { oid: 'it-user', upn: 'it@example.com' }
const a = secretsClientFor({ account: accountA, user, role: 'admin' })
const b = secretsClientFor({ account: accountB, user, role: 'admin' })
const name = `it/${randomUUID()}/db`

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    return e instanceof DomainError ? e.code : `raw:${(e as Error).name}`
  }
  return 'ok'
}

afterAll(() => clearClientCache())

describe('secret lifecycle against moto', () => {
  let v1 = ''
  let v2 = ''

  it('creates a secret with tags, readable only in its own account', async () => {
    const created = await createSecret(a, {
      name,
      description: 'integration',
      value: JSON.stringify({ user: 'app', password: 'one' }),
      tags: { team: 'it' },
    })
    v1 = created.versionId!
    const meta = await describeSecret(a, name)
    expect(meta).toMatchObject({ name, tags: { team: 'it' }, currentVersionId: v1 })
    expect(await codeOf(describeSecret(b, name))).toBe('NotFound')
  })

  it('finds it by name and tag filter', async () => {
    const byName = await listSecrets(a, { search: name })
    expect(byName.items.map((i) => i.name)).toContain(name)
    const byTag = await listSecrets(a, { tagKey: 'team', tagValue: 'it' })
    expect(byTag.items.map((i) => i.name)).toContain(name)
  })

  it('updates with a base-version check and rejects a stale update', async () => {
    v2 = (await putSecretValue(a, name, JSON.stringify({ user: 'app', password: 'two' }), v1))
      .versionId!
    expect(v2).not.toBe(v1)
    expect(await codeOf(putSecretValue(a, name, 'stale', v1))).toBe('Conflict')
    expect((await getSecretValue(a, name)).value).toContain('two')
    expect((await getSecretValue(a, name, v1)).value).toContain('one')
  })

  it('lists versions with stages', async () => {
    const versions = await listVersions(a, name)
    const byId = Object.fromEntries(versions.map((v) => [v.versionId, v.stages]))
    expect(byId[v2]).toContain('AWSCURRENT')
    expect(byId[v1]).toContain('AWSPREVIOUS')
  })

  it('rolls back, and rejects a stale rollback', async () => {
    expect(await codeOf(rollbackSecret(a, name, v1, v1))).toBe('Conflict')
    await rollbackSecret(a, name, v1, v2)
    expect((await describeSecret(a, name)).currentVersionId).toBe(v1)
    expect((await getSecretValue(a, name)).value).toContain('one')
  })

  it('edits tags', async () => {
    await updateTags(a, name, { set: { owner: 'thi' }, remove: ['team'] })
    expect((await describeSecret(a, name)).tags).toEqual({ owner: 'thi' })
  })

  it('deletes with a recovery window, lists it as deleted, then restores', async () => {
    const { deletionDate } = await deleteSecret(a, name)
    expect(deletionDate).toBeDefined()
    expect((await listDeleted(a)).items.map((i) => i.name)).toContain(name)
    await restoreSecret(a, name)
    expect((await listDeleted(a)).items.map((i) => i.name)).not.toContain(name)
    expect((await describeSecret(a, name)).deletedDate).toBeUndefined()
  })

  it('maps a duplicate create to AlreadyExists', async () => {
    expect(await codeOf(createSecret(a, { name, value: 'x' }))).toBe('AlreadyExists')
  })
})
