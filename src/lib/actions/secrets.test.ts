import {
  CreateSecretCommand,
  DeleteSecretCommand,
  DescribeSecretCommand,
  GetSecretValueCommand,
  ListSecretVersionIdsCommand,
  PutSecretValueCommand,
  RestoreSecretCommand,
  SecretsManagerClient,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateSecretVersionStageCommand,
} from '@aws-sdk/client-secrets-manager'
import { mockClient } from 'aws-sdk-client-mock'
import { format } from 'node:util'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Action, Role } from '@/lib/auth/rbac'
import type { SessionUser } from '@/lib/auth/session'
import { ACCOUNTS } from '@/lib/auth/test-fixtures'

// A non-JSON value: Node's JSON.parse error would quote it verbatim if it ever got parsed.
const PLANTED = 'planted-SECRET-{not json'

let currentUser: SessionUser | null = null
vi.mock('@/lib/auth/session', () => ({ readSession: async () => currentUser }))
let configThrows = false
vi.mock('@/lib/config', async (orig) => ({
  ...(await orig<typeof import('@/lib/config')>()),
  getConfig: () => {
    if (configThrows) throw new Error(`config exploded ${PLANTED}`)
    return { ACCOUNTS }
  },
}))

const actions = await import('./secrets')
const sm = mockClient(SecretsManagerClient)

const user = (roles: Record<string, Role>): SessionUser => ({
  oid: 'oid-1',
  tid: 't',
  name: 'Ann',
  upn: 'ann@example.com',
  roles,
  exp: Math.floor(Date.now() / 1000) + 3600,
})

const V1 = 'aaaaaaaa-0000-0000-0000-000000000001'
const V2 = 'aaaaaaaa-0000-0000-0000-000000000002'
const target = { accountId: 'dev', name: 'team/app/db' }

type Case = { fn: (i: unknown) => Promise<unknown>; action: Action; min: Role; input: object }
const CASES: Record<string, Case> = {
  revealSecret: { fn: actions.revealSecret, action: 'reveal', min: 'reader', input: target },
  getVersionValue: {
    fn: actions.getVersionValue,
    action: 'reveal',
    min: 'reader',
    input: { ...target, versionId: V1 },
  },
  createSecret: {
    fn: actions.createSecret,
    action: 'create',
    min: 'writer',
    input: { ...target, value: PLANTED, tags: { team: 'a' } },
  },
  updateSecretValue: {
    fn: actions.updateSecretValue,
    action: 'update',
    min: 'writer',
    input: { ...target, value: PLANTED, baseVersionId: V1 },
  },
  updateTags: {
    fn: actions.updateTags,
    action: 'tag',
    min: 'writer',
    input: { ...target, set: { owner: 'x' }, remove: ['team'] },
  },
  deleteSecret: { fn: actions.deleteSecret, action: 'delete', min: 'admin', input: target },
  restoreSecret: { fn: actions.restoreSecret, action: 'restore', min: 'admin', input: target },
  getVersions: { fn: actions.getVersions, action: 'view', min: 'reader', input: target },
  rollbackSecret: {
    fn: actions.rollbackSecret,
    action: 'rollback',
    min: 'admin',
    input: { ...target, targetVersionId: V2, expectedCurrentVersionId: V1 },
  },
}

const BELOW: Record<Role, Role | null> = { reader: null, writer: 'reader', admin: 'writer' }

// Capture everything the code under test writes: raw stdout/stderr (pino) and console.*
// (Next's and React's default error printing), since vitest routes console around the streams.
let captured = ''
const original = { out: process.stdout.write, err: process.stderr.write }
const CONSOLE = ['log', 'info', 'warn', 'error', 'debug'] as const
beforeAll(() => {
  const tap = (stream: NodeJS.WriteStream, orig: typeof process.stdout.write) =>
    ((chunk: unknown, ...rest: unknown[]) => {
      captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk as Uint8Array).toString()
      return (orig as (...a: unknown[]) => boolean).call(stream, chunk, ...rest)
    }) as typeof process.stdout.write
  process.stdout.write = tap(process.stdout, original.out)
  process.stderr.write = tap(process.stderr, original.err)
  for (const m of CONSOLE) {
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      captured += `${format(...args)}\n`
    })
  }
})
afterAll(() => {
  process.stdout.write = original.out
  process.stderr.write = original.err
  vi.restoreAllMocks()
  // The whole suite ran with PLANTED as the value in every path; none of it may be logged.
  expect(captured).not.toContain(PLANTED)
})

const auditLines = () =>
  captured
    .split('\n')
    .filter((l) => l.includes('"type":"audit"'))
    .map((l) => JSON.parse(l) as Record<string, unknown>)
const lastAudit = () => auditLines().at(-1)!

function happyAws() {
  sm.on(GetSecretValueCommand).resolves({ VersionId: V1, SecretString: PLANTED })
  sm.on(DescribeSecretCommand).resolves({ VersionIdsToStages: { [V1]: ['AWSCURRENT'] } })
  sm.on(CreateSecretCommand).resolves({ Name: target.name, VersionId: V1 })
  sm.on(PutSecretValueCommand).resolves({ VersionId: V2 })
  sm.on(TagResourceCommand).resolves({})
  sm.on(UntagResourceCommand).resolves({})
  sm.on(DeleteSecretCommand).resolves({})
  sm.on(RestoreSecretCommand).resolves({})
  sm.on(UpdateSecretVersionStageCommand).resolves({})
  sm.on(ListSecretVersionIdsCommand).resolves({
    Versions: [{ VersionId: V1, VersionStages: ['AWSCURRENT'] }],
  })
}

beforeEach(() => {
  sm.reset()
  happyAws()
})
afterEach(() => {
  currentUser = null
  configThrows = false
})

describe.each(Object.entries(CASES))('%s', (_name, c) => {
  it(`succeeds for ${c.min} and writes an ok audit line`, async () => {
    currentUser = user({ dev: c.min })
    const res = (await c.fn(c.input)) as { ok: boolean }
    expect(res.ok).toBe(true)
    expect(lastAudit()).toMatchObject({
      action: c.action,
      outcome: 'ok',
      account: 'dev',
      tier: c.min,
      secretName: target.name,
      user: { oid: 'oid-1', upn: 'ann@example.com' },
    })
  })

  const below = BELOW[c.min]
  if (below) {
    it(`is Forbidden for ${below}, names only the tier, and is audited as denied`, async () => {
      currentUser = user({ dev: below })
      const res = await c.fn(c.input)
      expect(res).toEqual({
        ok: false,
        code: 'Forbidden',
        message: `This action requires ${c.min}.`,
      })
      expect(lastAudit()).toMatchObject({
        action: c.action,
        outcome: 'denied',
        code: 'Forbidden',
        user: { oid: 'oid-1', upn: 'ann@example.com' },
        tier: below,
      })
      expect(sm.calls()).toHaveLength(0)
    })
  }

  it('is NotFound in an account where the user has no role', async () => {
    currentUser = user({ prod: 'admin' })
    const res = await c.fn(c.input)
    expect(res).toMatchObject({ ok: false, code: 'NotFound' })
    expect(lastAudit()).toMatchObject({
      outcome: 'denied',
      account: 'dev',
      code: 'NotFound',
      user: { oid: 'oid-1' },
    })
    expect(lastAudit().tier).toBeUndefined()
    expect(sm.calls()).toHaveLength(0)
  })

  it('rejects an unauthenticated call', async () => {
    const res = await c.fn(c.input)
    expect(res).toMatchObject({ ok: false, code: 'Unauthenticated' })
    expect(lastAudit()).toMatchObject({ outcome: 'denied', code: 'Unauthenticated' })
    expect(lastAudit().user).toBeUndefined()
  })

  it('rejects invalid input without calling AWS', async () => {
    currentUser = user({ dev: 'admin' })
    const res = await c.fn({ ...c.input, name: '../../etc passwd', value: `${PLANTED}\u0000` })
    expect(res).toMatchObject({ ok: false, code: 'InvalidInput' })
    expect(lastAudit()).toMatchObject({
      outcome: 'error',
      code: 'InvalidInput',
      account: 'dev',
      user: { oid: 'oid-1' },
    })
    expect(lastAudit().secretName).toBeUndefined()
    expect(sm.calls()).toHaveLength(0)
  })

  it('maps an AWS failure whose message contains the value to a fixed message', async () => {
    currentUser = user({ dev: 'admin' })
    sm.reset()
    sm.onAnyCommand().rejects(
      Object.assign(new Error(`boom ${PLANTED}`), {
        name: 'AccessDeniedException',
        $metadata: { requestId: 'req-9' },
      }),
    )
    const res = (await c.fn(c.input)) as { ok: false; message: string }
    expect(res).toMatchObject({ ok: false, code: 'AccessDenied' })
    expect(res.message).not.toContain(PLANTED)
    expect(lastAudit()).toMatchObject({
      outcome: 'error',
      code: 'AccessDenied',
      aws: { name: 'AccessDeniedException', requestId: 'req-9' },
    })
  })

  it('maps a non-AWS throw inside the AWS layer to a fixed error', async () => {
    currentUser = user({ dev: 'admin' })
    sm.reset()
    sm.onAnyCommand().callsFake(() => {
      throw new TypeError(`unexpected ${PLANTED}`)
    })
    const res = await c.fn(c.input)
    expect(res).toMatchObject({ ok: false, code: 'Unavailable' })
    expect(JSON.stringify(res)).not.toContain(PLANTED)
  })

  it('maps an unexpected throw outside the AWS layer to Internal', async () => {
    currentUser = user({ dev: 'admin' })
    configThrows = true
    const res = await c.fn(c.input)
    expect(res).toEqual({ ok: false, code: 'Internal', message: 'Something went wrong.' })
    expect(lastAudit()).toMatchObject({
      outcome: 'error',
      code: 'Internal',
      user: { oid: 'oid-1' },
    })
  })
})

describe('reveal', () => {
  it('returns the value to the caller (the only place it goes)', async () => {
    currentUser = user({ dev: 'reader' })
    expect(await actions.revealSecret(target)).toEqual({
      ok: true,
      data: { versionId: V1, kind: 'string', value: PLANTED },
    })
  })

  it('audits the version for a version reveal', async () => {
    currentUser = user({ dev: 'reader' })
    await actions.getVersionValue({ ...target, versionId: V1 })
    expect(lastAudit()).toMatchObject({ action: 'reveal', versionId: V1 })
  })
})

describe('updateTags', () => {
  it('rejects an empty change instead of auditing a no-op as ok', async () => {
    currentUser = user({ dev: 'writer' })
    expect(await actions.updateTags({ ...target })).toMatchObject({ code: 'InvalidInput' })
  })

  it('rejects reserved aws: tag keys in any case, including removals', async () => {
    currentUser = user({ dev: 'writer' })
    for (const input of [
      { ...target, set: { 'AWS:x': 'y' } },
      { ...target, remove: ['aws:cloudformation:stack-name'] },
      { ...target, set: { 'a\nb': 'y' } },
    ]) {
      expect(await actions.updateTags(input)).toMatchObject({ code: 'InvalidInput' })
    }
  })
})

describe('update', () => {
  it('returns Conflict when the base version is stale', async () => {
    currentUser = user({ dev: 'writer' })
    sm.on(DescribeSecretCommand).resolves({ VersionIdsToStages: { [V2]: ['AWSCURRENT'] } })
    const res = await actions.updateSecretValue({ ...target, value: 'x', baseVersionId: V1 })
    expect(res).toMatchObject({ ok: false, code: 'Conflict' })
    expect(sm.commandCalls(PutSecretValueCommand)).toHaveLength(0)
  })
})
