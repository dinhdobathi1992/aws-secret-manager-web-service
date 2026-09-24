import type { Account } from '@/lib/config'

export const ROLES = ['reader', 'writer', 'admin'] as const
export type Role = (typeof ROLES)[number]

export type Action =
  | 'list'
  | 'view'
  | 'reveal'
  | 'create'
  | 'update'
  | 'tag'
  | 'delete'
  | 'restore'
  | 'rollback'
  | 'activity'

/**
 * Single source of truth for the role matrix in the plan. can(), requireRole() and the
 * AWS session-policy tier all derive from this table.
 */
export const ACTION_MIN_ROLE: Record<Action, Role> = {
  list: 'reader',
  view: 'reader',
  reveal: 'reader',
  create: 'writer',
  update: 'writer',
  tag: 'writer',
  delete: 'admin',
  restore: 'admin',
  rollback: 'admin',
  // Admin-only CloudTrail activity page for the account.
  activity: 'admin',
}

const RANK: Record<Role, number> = { reader: 1, writer: 2, admin: 3 }

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function can(role: Role | null | undefined, action: Action): boolean {
  return !!role && RANK[role] >= RANK[ACTION_MIN_ROLE[action]]
}

/** Highest role whose group the user belongs to in this account; null when none. */
export function roleFor(groups: readonly string[], account: Account): Role | null {
  const set = new Set(groups.map((g) => g.toLowerCase()))
  for (const role of [...ROLES].reverse()) {
    if (set.has(account.groups[role].toLowerCase())) return role
  }
  return null
}

/** Resolves the per-account role map stored in the session. Accounts with no role are omitted. */
export function resolveRoles(
  groups: readonly string[],
  accounts: readonly Account[],
): Record<string, Role> {
  const roles: Record<string, Role> = {}
  for (const account of accounts) {
    const role = roleFor(groups, account)
    if (role) roles[account.id] = role
  }
  return roles
}
