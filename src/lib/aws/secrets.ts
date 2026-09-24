import 'server-only'
import {
  CreateSecretCommand,
  DeleteSecretCommand,
  DescribeSecretCommand,
  GetSecretValueCommand,
  ListSecretsCommand,
  ListSecretVersionIdsCommand,
  PutSecretValueCommand,
  RestoreSecretCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateSecretVersionStageCommand,
  type DescribeSecretCommandOutput,
  type Filter,
  type SecretsManagerClient,
  type Tag,
} from '@aws-sdk/client-secrets-manager'
import { DomainError, toDomainError } from './errors'

export const RECOVERY_WINDOW_DAYS = 30
const CURRENT = 'AWSCURRENT'

export type Tags = Record<string, string>

/** List/metadata DTOs never carry values. */
export type SecretSummary = {
  name: string
  description?: string
  tags: Tags
  lastChangedDate?: string
  createdDate?: string
  /**
   * For secrets scheduled for deletion: when deletion was REQUESTED (verified on real AWS
   * 2026-09-25; moto instead returns the permanent-deletion date). The permanent date is this
   * plus the recovery window, which only the DeleteSecret response reports.
   */
  deletedDate?: string
}

export type SecretMeta = SecretSummary & {
  arn: string
  kmsKeyId?: string
  lastAccessedDate?: string
  currentVersionId?: string
}

export type SecretVersion = {
  versionId: string
  stages: string[]
  createdDate?: string
  lastAccessedDate?: string
}

export type SecretValue = { versionId?: string; kind: 'string' | 'binary'; value: string }

const iso = (d?: Date) => d?.toISOString()
const tagsOf = (tags?: Tag[]): Tags =>
  Object.fromEntries((tags ?? []).filter((t) => t.Key).map((t) => [t.Key!, t.Value ?? '']))
const toTagList = (tags: Tags): Tag[] =>
  Object.entries(tags).map(([Key, Value]) => ({ Key, Value }))

/** Runs an SDK call and maps any failure to a DomainError (no AWS message text survives). */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    throw toDomainError(err)
  }
}

export type ListOptions = {
  search?: string
  tagKey?: string
  tagValue?: string
  nextToken?: string
  maxResults?: number
}

export async function listSecrets(
  client: SecretsManagerClient,
  opts: ListOptions = {},
): Promise<{ items: SecretSummary[]; nextToken?: string }> {
  const filters: Filter[] = []
  if (opts.search) filters.push({ Key: 'name', Values: [opts.search] })
  if (opts.tagKey) filters.push({ Key: 'tag-key', Values: [opts.tagKey] })
  if (opts.tagValue) filters.push({ Key: 'tag-value', Values: [opts.tagValue] })
  const out = await call(() =>
    client.send(
      new ListSecretsCommand({
        Filters: filters.length ? filters : undefined,
        NextToken: opts.nextToken,
        MaxResults: opts.maxResults ?? 50,
        SortOrder: 'asc',
      }),
    ),
  )
  return {
    items: (out.SecretList ?? []).map((s) => ({
      name: s.Name!,
      description: s.Description,
      tags: tagsOf(s.Tags),
      lastChangedDate: iso(s.LastChangedDate),
      createdDate: iso(s.CreatedDate),
    })),
    nextToken: out.NextToken,
  }
}

function currentVersionOf(out: DescribeSecretCommandOutput): string | undefined {
  return Object.entries(out.VersionIdsToStages ?? {}).find(([, stages]) =>
    stages.includes(CURRENT),
  )?.[0]
}

export async function describeSecret(
  client: SecretsManagerClient,
  name: string,
): Promise<SecretMeta> {
  const out = await call(() => client.send(new DescribeSecretCommand({ SecretId: name })))
  return {
    name: out.Name!,
    arn: out.ARN!,
    description: out.Description,
    tags: tagsOf(out.Tags),
    kmsKeyId: out.KmsKeyId,
    createdDate: iso(out.CreatedDate),
    lastChangedDate: iso(out.LastChangedDate),
    lastAccessedDate: iso(out.LastAccessedDate),
    deletedDate: iso(out.DeletedDate),
    currentVersionId: currentVersionOf(out),
  }
}

async function currentVersionId(
  client: SecretsManagerClient,
  name: string,
): Promise<string | undefined> {
  const out = await call(() => client.send(new DescribeSecretCommand({ SecretId: name })))
  return currentVersionOf(out)
}

/** Returns the value. Binary secrets come back base64-encoded and are read-only in the UI. */
export async function getSecretValue(
  client: SecretsManagerClient,
  name: string,
  versionId?: string,
): Promise<SecretValue> {
  const out = await call(() =>
    client.send(
      new GetSecretValueCommand({
        SecretId: name,
        ...(versionId ? { VersionId: versionId } : { VersionStage: CURRENT }),
      }),
    ),
  )
  if (out.SecretString !== undefined) {
    return { versionId: out.VersionId, kind: 'string', value: out.SecretString }
  }
  return {
    versionId: out.VersionId,
    kind: 'binary',
    value: Buffer.from(out.SecretBinary ?? new Uint8Array()).toString('base64'),
  }
}

export async function createSecret(
  client: SecretsManagerClient,
  input: { name: string; description?: string; value: string; tags?: Tags },
): Promise<{ name: string; versionId?: string }> {
  const out = await call(() =>
    client.send(
      new CreateSecretCommand({
        Name: input.name,
        Description: input.description || undefined,
        SecretString: input.value,
        Tags: input.tags && Object.keys(input.tags).length ? toTagList(input.tags) : undefined,
      }),
    ),
  )
  return { name: out.Name!, versionId: out.VersionId }
}

/**
 * Writes a new AWSCURRENT version, but only if AWSCURRENT is still `baseVersionId`. Secrets
 * Manager has no compare-and-swap, so this narrows the lost-update window to the gap between
 * the re-read and the put.
 */
export async function putSecretValue(
  client: SecretsManagerClient,
  name: string,
  value: string,
  baseVersionId: string,
): Promise<{ versionId?: string }> {
  if ((await currentVersionId(client, name)) !== baseVersionId) throw new DomainError('Conflict')
  const out = await call(() =>
    client.send(new PutSecretValueCommand({ SecretId: name, SecretString: value })),
  )
  return { versionId: out.VersionId }
}

export async function updateTags(
  client: SecretsManagerClient,
  name: string,
  change: { set?: Tags; remove?: string[] },
): Promise<void> {
  const remove = (change.remove ?? []).filter((k) => !(change.set && k in change.set))
  if (remove.length) {
    await call(() => client.send(new UntagResourceCommand({ SecretId: name, TagKeys: remove })))
  }
  if (change.set && Object.keys(change.set).length) {
    await call(() =>
      client.send(new TagResourceCommand({ SecretId: name, Tags: toTagList(change.set!) })),
    )
  }
}

/** All retained versions, including deprecated ones (not only current/previous). */
export async function listVersions(
  client: SecretsManagerClient,
  name: string,
): Promise<SecretVersion[]> {
  const versions: SecretVersion[] = []
  let token: string | undefined
  do {
    const out = await call(() =>
      client.send(
        new ListSecretVersionIdsCommand({
          SecretId: name,
          IncludeDeprecated: true,
          NextToken: token,
          MaxResults: 100,
        }),
      ),
    )
    for (const v of out.Versions ?? []) {
      versions.push({
        versionId: v.VersionId!,
        stages: v.VersionStages ?? [],
        createdDate: iso(v.CreatedDate),
        lastAccessedDate: iso(v.LastAccessedDate),
      })
    }
    token = out.NextToken
  } while (token)
  // Current first, then previous, then newest; timestamps alone can tie.
  const rank = (v: SecretVersion) =>
    v.stages.includes(CURRENT) ? 0 : v.stages.includes('AWSPREVIOUS') ? 1 : 2
  return versions.sort(
    (a, b) => rank(a) - rank(b) || (b.createdDate ?? '').localeCompare(a.createdDate ?? ''),
  )
}

/**
 * Makes `targetVersionId` current, only if AWSCURRENT is still `expectedCurrentVersionId`.
 * AWS itself rejects the move when RemoveFromVersionId no longer holds AWSCURRENT; both the
 * pre-check and that rejection surface as Conflict.
 */
export async function rollbackSecret(
  client: SecretsManagerClient,
  name: string,
  targetVersionId: string,
  expectedCurrentVersionId: string,
): Promise<void> {
  if ((await currentVersionId(client, name)) !== expectedCurrentVersionId) {
    throw new DomainError('Conflict')
  }
  if (targetVersionId === expectedCurrentVersionId) return
  try {
    await client.send(
      new UpdateSecretVersionStageCommand({
        SecretId: name,
        VersionStage: CURRENT,
        MoveToVersionId: targetVersionId,
        RemoveFromVersionId: expectedCurrentVersionId,
      }),
    )
  } catch (err) {
    const mapped = toDomainError(err)
    throw mapped.diagnostics.awsName === 'InvalidParameterException'
      ? new DomainError('Conflict', mapped.diagnostics)
      : mapped
  }
}

/** Schedules deletion with the 30-day recovery window. Force delete is not offered. */
export async function deleteSecret(
  client: SecretsManagerClient,
  name: string,
): Promise<{ deletionDate?: string }> {
  const out = await call(() =>
    client.send(
      new DeleteSecretCommand({ SecretId: name, RecoveryWindowInDays: RECOVERY_WINDOW_DAYS }),
    ),
  )
  return { deletionDate: iso(out.DeletionDate) }
}

const DELETED_SCAN_PAGES = 10

/**
 * Secrets scheduled for deletion. ListSecrets can't filter on DeletedDate, so this scans up to
 * DELETED_SCAN_PAGES pages (1,000 secrets) per call and returns a token to continue.
 */
export async function listDeleted(
  client: SecretsManagerClient,
  nextToken?: string,
): Promise<{ items: SecretSummary[]; nextToken?: string }> {
  const items: SecretSummary[] = []
  let token = nextToken
  for (let page = 0; page < DELETED_SCAN_PAGES; page++) {
    const out = await call(() =>
      client.send(
        new ListSecretsCommand({ IncludePlannedDeletion: true, NextToken: token, MaxResults: 100 }),
      ),
    )
    for (const s of out.SecretList ?? []) {
      if (!s.DeletedDate) continue
      items.push({
        name: s.Name!,
        description: s.Description,
        tags: tagsOf(s.Tags),
        lastChangedDate: iso(s.LastChangedDate),
        deletedDate: iso(s.DeletedDate),
      })
    }
    token = out.NextToken
    if (!token) break
  }
  return { items, nextToken: token }
}

export async function restoreSecret(client: SecretsManagerClient, name: string): Promise<void> {
  await call(() => client.send(new RestoreSecretCommand({ SecretId: name })))
}
