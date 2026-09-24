import 'server-only'
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { createHash } from 'node:crypto'
import { fromNodeProviderChain, fromTemporaryCredentials } from '@aws-sdk/credential-providers'
import type { Role } from '@/lib/auth/rbac'
import type { Account } from '@/lib/config'
import { TIER_SESSION_POLICY } from './session-policies'

/** STS RoleSessionName / SourceIdentity allow [\w+=,.@-], 2..64 chars. */
export function stsSafe(value: string, max = 64): string {
  const cleaned = value.replace(/[^\w+=,.@-]/g, '-').slice(0, max)
  return cleaned.length >= 2 ? cleaned : `${cleaned}--`.slice(0, 2)
}

/**
 * SourceIdentity for CloudTrail. UPNs that don't fit STS rules as-is (long guest UPNs with
 * #EXT#, other characters) get a readable prefix plus a hash, so two users never collide.
 */
export function sourceIdentityFor(upn: string): string {
  if (/^[\w+=,.@-]{2,64}$/.test(upn)) return upn
  const hash = createHash('sha256').update(upn).digest('hex').slice(0, 12)
  return `${stsSafe(upn, 51)}-${hash}`
}

export type CredentialScope = {
  account: Account
  user: { oid: string; upn: string }
  role: Role
}

export function assumeRoleParams({ account, user, role }: CredentialScope) {
  return {
    RoleArn: account.roleArn,
    RoleSessionName: stsSafe(`sc-${user.oid}`),
    // Required by the target trust policy, so CloudTrail shows the real person.
    SourceIdentity: sourceIdentityFor(user.upn),
    Policy: TIER_SESSION_POLICY[role],
    DurationSeconds: 900,
  }
}

const MAX_CLIENTS = 200
const IDLE_TTL_MS = 60 * 60 * 1000
// One base identity (IRSA / profile / env) shared by all clients; each client only adds AssumeRole.
let baseIdentity: ReturnType<typeof fromNodeProviderChain> | undefined
const base = () => (baseIdentity ??= fromNodeProviderChain())

const clients = new Map<string, { client: SecretsManagerClient; lastUsed: number }>()

/**
 * One Secrets Manager client per (account, user, tier). Different users never share a client or
 * assumed-role session. The SDK refreshes those temporary keys before they expire. The base
 * identity is the default chain: IRSA in EKS, a profile or env locally.
 */
export function secretsClientFor(scope: CredentialScope): SecretsManagerClient {
  const key = `${scope.account.id}|${scope.user.oid}|${scope.role}`
  const now = Date.now()
  const hit = clients.get(key)
  if (hit && now - hit.lastUsed < IDLE_TTL_MS) {
    // Re-insert to keep Map order as LRU order.
    clients.delete(key)
    hit.lastUsed = now
    clients.set(key, hit)
    return hit.client
  }
  // Expired or evicted clients are dropped, not destroyed: destroy() would abort requests
  // another caller may still have in flight. GC reclaims them.
  if (hit) clients.delete(key)

  const region = scope.account.region
  const client = new SecretsManagerClient({
    region,
    credentials: fromTemporaryCredentials({
      params: assumeRoleParams(scope),
      masterCredentials: base(),
      clientConfig: { region },
    }),
  })
  clients.set(key, { client, lastUsed: now })
  while (clients.size > MAX_CLIENTS) {
    clients.delete(clients.keys().next().value as string)
  }
  return client
}

/** Test hook. */
export function clearClientCache(): void {
  for (const { client } of clients.values()) client.destroy()
  clients.clear()
}

export function clientCacheSize(): number {
  return clients.size
}
