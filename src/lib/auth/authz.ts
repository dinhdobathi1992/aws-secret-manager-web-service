import { forbidden, notFound, redirect } from 'next/navigation'
import { getConfig, type Account } from '@/lib/config'
import { ACTION_MIN_ROLE, can, type Action, type Role } from './rbac'
import { readSession, type SessionUser } from './session'

export type AuthzErrorCode = 'Unauthenticated' | 'NotFound' | 'Forbidden'

export class AuthzError extends Error {
  override name = 'AuthzError'
  constructor(
    readonly code: AuthzErrorCode,
    /** For Forbidden: the tier the action needs. Never a group id or name. */
    readonly requiredRole?: Role,
  ) {
    super(code === 'Forbidden' ? `requires ${requiredRole}` : code)
  }
}

export type Authorized = { user: SessionUser; account: Account; role: Role }

/**
 * Pure authorization decision. An unknown account and an account where the user has no role look
 * identical (NotFound), so account ids don't leak. A role below the minimum is Forbidden.
 */
export function authorize(
  user: SessionUser | null,
  accountId: string,
  action: Action,
  accounts: readonly Account[],
): Authorized {
  if (!user) throw new AuthzError('Unauthenticated')
  const account = accounts.find((a) => a.id === accountId)
  const role = account ? user.roles[account.id] : undefined
  if (!account || !role) throw new AuthzError('NotFound')
  if (!can(role, action)) throw new AuthzError('Forbidden', ACTION_MIN_ROLE[action])
  return { user, account, role }
}

export async function requireSession(): Promise<SessionUser> {
  const user = await readSession()
  if (!user) throw new AuthzError('Unauthenticated')
  return user
}

/** Server-side authorization for actions. Throws AuthzError. */
export async function requireRole(accountId: string, action: Action): Promise<Authorized> {
  return authorize(await readSession(), accountId, action, getConfig().ACCOUNTS)
}

/** Page variant: maps AuthzError onto Next's login redirect, 404 and 403 pages. */
export async function requirePageRole(
  accountId: string,
  action: Action,
  returnTo: string,
): Promise<Authorized> {
  try {
    return await requireRole(accountId, action)
  } catch (err) {
    if (!(err instanceof AuthzError)) throw err
    if (err.code === 'Unauthenticated') {
      redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`)
    }
    if (err.code === 'NotFound') notFound()
    forbidden()
  }
}
