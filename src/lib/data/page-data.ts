import 'server-only'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { requirePageRole, type Authorized } from '@/lib/auth/authz'
import type { Action, Role } from '@/lib/auth/rbac'
import { secretsClientFor } from '@/lib/aws/assume-role'
import { toDomainError, type DomainErrorCode } from '@/lib/aws/errors'
import { getConfig } from '@/lib/config'
import { logger } from '@/lib/logger'
import { shortAccountId } from '@/lib/ui/format'

/** Authorizes a page (redirect / 404 / 403 on failure) and returns the caller's AWS client. */
export async function pageContext(accountId: string, action: Action) {
  const returnTo = (await headers()).get('x-pathname') ?? `/a/${accountId}`
  const auth = await requirePageRole(accountId, action, returnTo)
  const client = secretsClientFor({ account: auth.account, user: auth.user, role: auth.role })
  return { auth, client }
}

export type Loaded<T> = { ok: true; data: T } | { ok: false; code: DomainErrorCode }

/**
 * Runs an AWS read for a server component. NotFound becomes the 404 page; every other failure
 * becomes a code the page renders as a fixed message (never thrown, so nothing reaches Next's
 * error printing).
 */
export async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    const e = toDomainError(err)
    if (e.code === 'NotFound') notFound()
    logger.warn({ event: 'page_load_failed', code: e.code, aws: e.diagnostics }, 'page load failed')
    return { ok: false, code: e.code }
  }
}

export type AccountOption = { id: string; name: string; shortId: string; role: Role }

/** Accounts the user has a role in, for the switcher. Accounts without a role are never listed. */
export function accountOptions(auth: Authorized): AccountOption[] {
  return getConfig()
    .ACCOUNTS.filter((a) => auth.user.roles[a.id])
    .map((a) => ({
      id: a.id,
      name: a.name,
      shortId: shortAccountId(a.roleArn),
      role: auth.user.roles[a.id],
    }))
}
