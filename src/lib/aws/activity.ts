import 'server-only'
import { LookupEventsCommand, type CloudTrailClient, type Event } from '@aws-sdk/client-cloudtrail'
import { safeParseJson } from '@/lib/json'
import { toDomainError } from './errors'

export type ActivityKind = 'reveal' | 'change' | 'read'

/** One CloudTrail event, reduced to an allow-list. Request/response bodies are never copied. */
export type ActivityEvent = {
  id: string
  time: string
  eventName: string
  label: string
  kind: ActivityKind
  who: string
  viaApp: boolean
  secretName?: string
  versionId?: string
  errorCode?: string
  sourceIp?: string
  requestId?: string
  roleSession?: string
}

const LABELS: Record<string, { label: string; kind: ActivityKind }> = {
  GetSecretValue: { label: 'View', kind: 'reveal' },
  // Per-secret GetSecretValue events are the views; the batch call itself is bookkeeping.
  BatchGetSecretValue: { label: 'View (batch)', kind: 'read' },
  CreateSecret: { label: 'Create', kind: 'change' },
  PutSecretValue: { label: 'Update value', kind: 'change' },
  UpdateSecret: { label: 'Update', kind: 'change' },
  UpdateSecretVersionStage: { label: 'Rollback', kind: 'change' },
  TagResource: { label: 'Edit tags', kind: 'change' },
  UntagResource: { label: 'Edit tags', kind: 'change' },
  DeleteSecret: { label: 'Delete', kind: 'change' },
  RestoreSecret: { label: 'Restore', kind: 'change' },
  RotateSecret: { label: 'Rotate', kind: 'change' },
  PutResourcePolicy: { label: 'Set policy', kind: 'change' },
  DeleteResourcePolicy: { label: 'Delete policy', kind: 'change' },
}

const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : undefined)
const obj = (v: unknown) =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

/**
 * arn:aws:secretsmanager:region:acct:secret:NAME-AbC123 → NAME; plain names pass through.
 * Full secret ARNs always end in '-' + 6 random characters; a partial ARN whose name happens to
 * end that way is indistinguishable, which is accepted (it only affects the link).
 */
export function secretNameFromId(id: string | undefined): string | undefined {
  if (!id) return undefined
  const m = id.match(/^arn:aws[\w-]*:secretsmanager:[^:]*:\d{12}:secret:(.+)-[A-Za-z0-9]{6}$/)
  return m ? m[1] : id
}

/**
 * Parses a CloudTrail event. `appRoleArn` is the account's configured role: calls through it with
 * a `sc-` session are the app's; everything else came from the console, CLI or other tooling.
 */
export function toActivityEvent(e: Event, appRoleArn: string): ActivityEvent | null {
  const parsed = e.CloudTrailEvent ? safeParseJson(e.CloudTrailEvent) : { ok: false as const }
  const ct = parsed.ok ? obj(parsed.value) : {}
  const identity = obj(ct.userIdentity)
  const session = obj(identity.sessionContext)
  const issuer = obj(session.sessionIssuer)
  const params = obj(ct.requestParameters)
  const eventName = e.EventName ?? str(ct.eventName) ?? 'Unknown'
  const meta = LABELS[eventName] ?? { label: eventName, kind: 'read' as const }

  const arn = str(identity.arn) ?? ''
  const roleSession = arn.includes(':assumed-role/') ? arn.split('/').pop() : undefined
  const viaApp = str(issuer.arn) === appRoleArn && !!roleSession?.startsWith('sc-')
  const who =
    str(session.sourceIdentity) ??
    str(identity.userName) ??
    str(e.Username) ??
    (arn ? arn.split('/').pop()! : 'unknown')

  const when = e.EventTime ?? (str(ct.eventTime) ? new Date(str(ct.eventTime)!) : undefined)
  // One malformed event must not break the page.
  if (!when || Number.isNaN(when.getTime())) return null

  return {
    id: e.EventId ?? `${e.EventTime?.toISOString()}-${eventName}`,
    time: when.toISOString(),
    eventName,
    label: meta.label,
    kind: meta.kind,
    who,
    viaApp,
    secretName: secretNameFromId(str(params.secretId) ?? str(params.name)),
    versionId: str(params.versionId) ?? str(params.moveToVersionId),
    errorCode: str(ct.errorCode),
    sourceIp: str(ct.sourceIPAddress),
    requestId: str(ct.requestID),
    roleSession,
  }
}

export type ActivityQuery = {
  start: Date
  end: Date
  nextToken?: string
  /** Keep fetching until this many events satisfy `match` (or pages run out). */
  minMatches?: number
  match?: (e: ActivityEvent) => boolean
  maxPages?: number
}

const PAGE_GAP_MS = 550 // LookupEvents allows ~2 calls/second per account and region.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Secrets Manager events for the account, newest first. A NextToken is only valid with the same
 * StartTime/EndTime as the call that produced it, so callers must pass the original window back.
 */
export async function lookupActivity(
  client: CloudTrailClient,
  appRoleArn: string,
  q: ActivityQuery,
): Promise<{ events: ActivityEvent[]; nextToken?: string }> {
  const events: ActivityEvent[] = []
  const match = q.match ?? (() => true)
  let matched = 0
  let token = q.nextToken
  try {
    for (let page = 0; page < (q.maxPages ?? 4); page++) {
      if (page > 0) await sleep(PAGE_GAP_MS)
      const out = await client.send(
        new LookupEventsCommand({
          LookupAttributes: [
            { AttributeKey: 'EventSource', AttributeValue: 'secretsmanager.amazonaws.com' },
          ],
          StartTime: q.start,
          EndTime: q.end,
          MaxResults: 50,
          NextToken: token,
        }),
      )
      for (const e of out.Events ?? []) {
        const a = toActivityEvent(e, appRoleArn)
        if (!a) continue
        events.push(a)
        if (match(a)) matched++
      }
      token = out.NextToken
      if (!token || matched >= (q.minMatches ?? 25)) break
    }
  } catch (err) {
    throw toDomainError(err)
  }
  return { events, nextToken: token }
}
