import { describe, expect, it } from 'vitest'
import { authorize, AuthzError } from './authz'
import { ACTION_MIN_ROLE, can, resolveRoles, roleFor, ROLES, type Action, type Role } from './rbac'
import type { SessionUser } from './session'
import { ACCOUNTS, gid } from './test-fixtures'

const ACTIONS = Object.keys(ACTION_MIN_ROLE) as Action[]

// The plan.md matrix, restated independently so a change to ACTION_MIN_ROLE fails loudly.
const MATRIX: Record<Action, Role[]> = {
  list: ['reader', 'writer', 'admin'],
  view: ['reader', 'writer', 'admin'],
  reveal: ['reader', 'writer', 'admin'],
  create: ['writer', 'admin'],
  update: ['writer', 'admin'],
  tag: ['writer', 'admin'],
  delete: ['admin'],
  restore: ['admin'],
  rollback: ['admin'],
  activity: ['admin'],
}

const user = (roles: Record<string, Role>): SessionUser => ({
  oid: 'oid-1',
  tid: 'tid',
  name: 'n',
  upn: 'u@example.com',
  roles,
  exp: Math.floor(Date.now() / 1000) + 3600,
})

describe('can', () => {
  for (const action of ACTIONS) {
    for (const role of ROLES) {
      const allowed = MATRIX[action].includes(role)
      it(`${role} ${allowed ? 'may' : 'may not'} ${action}`, () => {
        expect(can(role, action)).toBe(allowed)
      })
    }
    it(`no role may not ${action}`, () => expect(can(null, action)).toBe(false))
  }

  it('admin ⊇ writer ⊇ reader', () => {
    for (const action of ACTIONS) {
      if (can('reader', action)) expect(can('writer', action)).toBe(true)
      if (can('writer', action)) expect(can('admin', action)).toBe(true)
    }
  })
})

describe('roleFor / resolveRoles', () => {
  it('highest matching group wins, case-insensitively', () => {
    expect(roleFor([gid(1, 1), gid(1, 3).toUpperCase()], ACCOUNTS[0])).toBe('admin')
    expect(roleFor([gid(1, 2)], ACCOUNTS[0])).toBe('writer')
  })

  it('a writer group in account A grants nothing in account B', () => {
    expect(resolveRoles([gid(1, 2)], ACCOUNTS)).toEqual({ dev: 'writer' })
  })

  it('no groups means no access', () => {
    expect(resolveRoles([], ACCOUNTS)).toEqual({})
    expect(resolveRoles(['unrelated-group'], ACCOUNTS)).toEqual({})
  })
})

describe('authorize', () => {
  const code = (fn: () => unknown) => {
    try {
      fn()
    } catch (e) {
      expect(e).toBeInstanceOf(AuthzError)
      return (e as AuthzError).code
    }
    return 'ok'
  }

  it('rejects a missing session', () => {
    expect(code(() => authorize(null, 'dev', 'list', ACCOUNTS))).toBe('Unauthenticated')
  })

  it('treats an unknown account and an account without a role the same (404)', () => {
    const u = user({ dev: 'admin' })
    expect(code(() => authorize(u, 'prod', 'list', ACCOUNTS))).toBe('NotFound')
    expect(code(() => authorize(u, 'nope', 'list', ACCOUNTS))).toBe('NotFound')
  })

  for (const action of ACTIONS) {
    for (const role of ROLES) {
      const allowed = MATRIX[action].includes(role)
      it(`${role} on ${action} → ${allowed ? 'ok' : 'Forbidden'}`, () => {
        const result = code(() => authorize(user({ dev: role }), 'dev', action, ACCOUNTS))
        expect(result).toBe(allowed ? 'ok' : 'Forbidden')
      })
    }
  }

  it('403 names only the required tier', () => {
    try {
      authorize(user({ dev: 'reader' }), 'dev', 'delete', ACCOUNTS)
    } catch (e) {
      expect((e as AuthzError).requiredRole).toBe('admin')
      expect((e as Error).message).toBe('requires admin')
    }
  })
})
