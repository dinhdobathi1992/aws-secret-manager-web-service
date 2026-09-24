import type { Account } from '@/lib/config'
import { resolveRoles } from './rbac'
import { SESSION_TTL_SECONDS, type SessionUser } from './session'

export class LoginError extends Error {
  override name = 'LoginError'
  constructor(readonly code: 'groups_overage' | 'missing_claims') {
    super(code)
  }
}

type IdTokenClaims = Record<string, unknown>

/**
 * Entra emits `_claim_names.groups` (or `hasgroups`) instead of `groups` when a user has too many
 * groups for the token. There is deliberately no Graph fallback: the app registration must emit
 * only the groups assigned to the application.
 */
export function hasGroupsOverage(claims: IdTokenClaims): boolean {
  const names = claims._claim_names as Record<string, unknown> | undefined
  return !!names?.groups || claims.hasgroups === true || claims.hasgroups === 'true'
}

/** Builds the session from verified id_token claims. Raw group ids are never stored. */
export function sessionFromClaims(
  claims: IdTokenClaims,
  accounts: readonly Account[],
  now = Date.now(),
): SessionUser {
  if (hasGroupsOverage(claims)) throw new LoginError('groups_overage')

  // oid is stable across apps in the tenant; sub is pairwise per app and not used as identity.
  const oid = typeof claims.oid === 'string' ? claims.oid : ''
  const tid = typeof claims.tid === 'string' ? claims.tid : ''
  if (!oid) throw new LoginError('missing_claims')

  const upn = [claims.upn, claims.preferred_username, claims.email].find(
    (v): v is string => typeof v === 'string' && v.length > 0,
  )
  const groups = Array.isArray(claims.groups)
    ? claims.groups.filter((g): g is string => typeof g === 'string')
    : []

  return {
    oid,
    tid,
    name: typeof claims.name === 'string' ? claims.name : (upn ?? oid),
    upn: upn ?? oid,
    roles: resolveRoles(groups, accounts),
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
  }
}
