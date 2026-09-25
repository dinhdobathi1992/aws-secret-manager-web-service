import {
  CreateSecretCommand,
  DeleteSecretCommand,
  DescribeSecretCommand,
  GetSecretValueCommand,
  ListSecretsCommand,
  ListSecretVersionIdsCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
  UpdateSecretVersionStageCommand,
} from '@aws-sdk/client-secrets-manager'
import { mockClient } from 'aws-sdk-client-mock'
import { beforeEach, describe, expect, it } from 'vitest'
import { DomainError, toDomainError } from './errors'
import {
  createSecret,
  deleteSecret,
  getSecretValue,
  listDeleted,
  listSecrets,
  listVersions,
  putSecretValue,
  rollbackSecret,
} from './secrets'

const sm = mockClient(SecretsManagerClient)
const client = new SecretsManagerClient({ region: 'ap-southeast-1' })
const awsError = (name: string, message = 'value=planted-secret-value') =>
  Object.assign(new Error(message), { name })

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError)
    return (e as DomainError).code
  }
  return 'ok'
}

beforeEach(() => sm.reset())

describe('error mapping', () => {
  it.each([
    ['ResourceNotFoundException', 'NotFound'],
    ['ResourceExistsException', 'AlreadyExists'],
    ['AccessDeniedException', 'AccessDenied'],
    ['InvalidParameterException', 'InvalidRequest'],
    ['ExpiredTokenException', 'CredentialsExpired'],
    ['CredentialsProviderError', 'CredentialsExpired'],
    ['UnrecognizedClientException', 'CredentialsExpired'],
    ['InvalidNextTokenException', 'InvalidRequest'],
    ['DecryptionFailure', 'AccessDenied'],
    ['constructor', 'Unavailable'],
    ['SomethingElse', 'Unavailable'],
  ])('%s → %s, without the AWS message', (name, code) => {
    const e = toDomainError(awsError(name))
    expect(e.code).toBe(code)
    expect(e.message).not.toContain('planted')
  })

  it('keeps allow-listed diagnostics for logs, never the message', () => {
    const e = toDomainError(
      Object.assign(awsError('AccessDeniedException'), {
        $metadata: { requestId: 'req-1', httpStatusCode: 400 },
      }),
    )
    expect(e.diagnostics).toEqual({
      awsName: 'AccessDeniedException',
      requestId: 'req-1',
      httpStatus: 400,
    })
    expect(JSON.stringify(e.diagnostics)).not.toContain('planted')
  })
})

describe('listSecrets', () => {
  it('passes name and tag filters and maps to value-free DTOs', async () => {
    sm.on(ListSecretsCommand).resolves({
      SecretList: [{ Name: 'team/app/db', Tags: [{ Key: 'team', Value: 'platform' }] }],
      NextToken: 't2',
    })
    const out = await listSecrets(client, { search: 'team', tagKey: 'team', tagValue: 'platform' })
    expect(sm.commandCalls(ListSecretsCommand)[0].args[0].input.Filters).toEqual([
      { Key: 'name', Values: ['team'] },
      { Key: 'tag-key', Values: ['team'] },
      { Key: 'tag-value', Values: ['platform'] },
    ])
    expect(out).toEqual({
      items: [{ name: 'team/app/db', tags: { team: 'platform' } }],
      nextToken: 't2',
    })
  })
})

describe('getSecretValue', () => {
  it('reads AWSCURRENT by default and a specific version on request', async () => {
    sm.on(GetSecretValueCommand).resolves({ VersionId: 'v1', SecretString: 'plain' })
    expect(await getSecretValue(client, 's')).toEqual({
      versionId: 'v1',
      kind: 'string',
      value: 'plain',
    })
    await getSecretValue(client, 's', 'v0')
    const inputs = sm.commandCalls(GetSecretValueCommand).map((c) => c.args[0].input)
    expect(inputs[0]).toEqual({ SecretId: 's', VersionStage: 'AWSCURRENT' })
    expect(inputs[1]).toEqual({ SecretId: 's', VersionId: 'v0' })
  })

  it('returns binary secrets as base64', async () => {
    sm.on(GetSecretValueCommand).resolves({ SecretBinary: new Uint8Array([1, 2, 3]) })
    expect(await getSecretValue(client, 's')).toMatchObject({ kind: 'binary', value: 'AQID' })
  })
})

describe('putSecretValue (lost-update guard)', () => {
  it('writes when AWSCURRENT is still the base version', async () => {
    sm.on(DescribeSecretCommand).resolves({ VersionIdsToStages: { v1: ['AWSCURRENT'] } })
    sm.on(PutSecretValueCommand).resolves({ VersionId: 'v2' })
    expect(await putSecretValue(client, 's', 'new', 'v1')).toEqual({ versionId: 'v2' })
  })

  it('returns Conflict without writing when AWSCURRENT moved', async () => {
    sm.on(DescribeSecretCommand).resolves({
      VersionIdsToStages: { v1: ['AWSPREVIOUS'], v2: ['AWSCURRENT'] },
    })
    expect(await codeOf(putSecretValue(client, 's', 'new', 'v1'))).toBe('Conflict')
    expect(sm.commandCalls(PutSecretValueCommand)).toHaveLength(0)
  })
})

describe('rollbackSecret (stale-state guard)', () => {
  it('moves AWSCURRENT from the expected version to the target', async () => {
    sm.on(DescribeSecretCommand).resolves({ VersionIdsToStages: { v2: ['AWSCURRENT'] } })
    sm.on(UpdateSecretVersionStageCommand).resolves({})
    await rollbackSecret(client, 's', 'v1', 'v2')
    expect(sm.commandCalls(UpdateSecretVersionStageCommand)[0].args[0].input).toEqual({
      SecretId: 's',
      VersionStage: 'AWSCURRENT',
      MoveToVersionId: 'v1',
      RemoveFromVersionId: 'v2',
    })
  })

  it('is a Conflict when current moved before the call', async () => {
    sm.on(DescribeSecretCommand).resolves({ VersionIdsToStages: { v3: ['AWSCURRENT'] } })
    expect(await codeOf(rollbackSecret(client, 's', 'v1', 'v2'))).toBe('Conflict')
    expect(sm.commandCalls(UpdateSecretVersionStageCommand)).toHaveLength(0)
  })

  it('does not turn other rollback failures into Conflict', async () => {
    sm.on(DescribeSecretCommand).resolves({ VersionIdsToStages: { v2: ['AWSCURRENT'] } })
    sm.on(UpdateSecretVersionStageCommand).rejects(awsError('LimitExceededException'))
    expect(await codeOf(rollbackSecret(client, 's', 'v1', 'v2'))).toBe('InvalidRequest')
  })

  it('is a Conflict when AWS rejects RemoveFromVersionId (race after the check)', async () => {
    sm.on(DescribeSecretCommand).resolves({ VersionIdsToStages: { v2: ['AWSCURRENT'] } })
    sm.on(UpdateSecretVersionStageCommand).rejects(awsError('InvalidParameterException'))
    expect(await codeOf(rollbackSecret(client, 's', 'v1', 'v2'))).toBe('Conflict')
  })
})

describe('listVersions', () => {
  it('includes deprecated versions and follows pagination', async () => {
    sm.on(ListSecretVersionIdsCommand)
      .resolvesOnce({
        Versions: [{ VersionId: 'v3', VersionStages: ['AWSCURRENT'], CreatedDate: new Date(3000) }],
        NextToken: 'n',
      })
      .resolvesOnce({
        Versions: [{ VersionId: 'v1', VersionStages: [], CreatedDate: new Date(1000) }],
      })
    const versions = await listVersions(client, 's')
    expect(versions.map((v) => v.versionId)).toEqual(['v3', 'v1'])
    for (const c of sm.commandCalls(ListSecretVersionIdsCommand)) {
      expect(c.args[0].input.IncludeDeprecated).toBe(true)
    }
  })
})

describe('create / delete / deleted list', () => {
  it('creates with tags', async () => {
    sm.on(CreateSecretCommand).resolves({ Name: 'n', VersionId: 'v1' })
    await createSecret(client, { name: 'n', value: 'x', tags: { team: 'a' } })
    expect(sm.commandCalls(CreateSecretCommand)[0].args[0].input.Tags).toEqual([
      { Key: 'team', Value: 'a' },
    ])
  })

  it('maps an existing name to AlreadyExists', async () => {
    sm.on(CreateSecretCommand).rejects(awsError('ResourceExistsException'))
    expect(await codeOf(createSecret(client, { name: 'n', value: 'x' }))).toBe('AlreadyExists')
  })

  it('deletes with a 30-day window and never forces', async () => {
    sm.on(DeleteSecretCommand).resolves({})
    await deleteSecret(client, 'n')
    const input = sm.commandCalls(DeleteSecretCommand)[0].args[0].input
    expect(input.RecoveryWindowInDays).toBe(30)
    expect(input.ForceDeleteWithoutRecovery).toBeUndefined()
  })

  it('scans past pages that contain no deleted secrets', async () => {
    sm.on(ListSecretsCommand)
      .resolvesOnce({ SecretList: [{ Name: 'live' }], NextToken: 'p2' })
      .resolvesOnce({ SecretList: [{ Name: 'gone', DeletedDate: new Date(0) }] })
    const out = await listDeleted(client)
    expect(out.items.map((i) => i.name)).toEqual(['gone'])
    expect(out.nextToken).toBeUndefined()
  })

  it('lists only secrets scheduled for deletion', async () => {
    sm.on(ListSecretsCommand).resolves({
      SecretList: [{ Name: 'live' }, { Name: 'gone', DeletedDate: new Date(0) }],
    })
    const out = await listDeleted(client)
    expect(sm.commandCalls(ListSecretsCommand)[0].args[0].input.IncludePlannedDeletion).toBe(true)
    expect(out.items.map((i) => i.name)).toEqual(['gone'])
  })
})
