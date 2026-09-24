import 'server-only'
import type { SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { randomUUID } from 'node:crypto'
import type { z } from 'zod'
import { audit, type AuditOutcome } from '@/lib/audit'
import { unstable_rethrow } from 'next/navigation'
import { authorize, AuthzError, type Authorized } from '@/lib/auth/authz'
import type { Action, Role } from '@/lib/auth/rbac'
import { readSession, type SessionUser } from '@/lib/auth/session'
import { secretsClientFor } from '@/lib/aws/assume-role'
import { DOMAIN_MESSAGES, DomainError, type DomainErrorCode } from '@/lib/aws/errors'
import { ACCOUNT_ID_RE, getConfig } from '@/lib/config'
import { errorFields, logger } from '@/lib/logger'

export type ActionErrorCode =
  'Unauthenticated' | 'Forbidden' | 'InvalidInput' | 'Internal' | DomainErrorCode

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; code: ActionErrorCode; message: string }

type Target = { accountId: string; name: string; versionId?: string }

type Ctx<I> = { input: I; auth: Authorized; client: SecretsManagerClient }

const FIXED: Record<'Unauthenticated' | 'InvalidInput' | 'Internal', string> = {
  Unauthenticated: 'Your session expired. Sign in again.',
  InvalidInput: 'The request was invalid.',
  Internal: 'Something went wrong.',
}

/** Best-effort audit target from unvalidated input: only well-formed, short strings. */
function rawTarget(input: unknown): { account?: string; secretName?: string } {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const pick = (v: unknown, re: RegExp) => (typeof v === 'string' && re.test(v) ? v : undefined)
  return {
    account: pick(o.accountId, ACCOUNT_ID_RE),
    secretName: pick(o.name, /^[A-Za-z0-9/_+=.@-]{1,512}$/),
  }
}

/**
 * The single wrapper for every server action:
 * validate (zod) → requireRole → AWS call, with errors mapped to fixed codes/messages and an
 * audit line written in `finally`, so denials and failures are audited too. No raw exception
 * text reaches the client or the logs.
 */
export async function withAction<S extends z.ZodType<Target>, T>(
  action: Action,
  schema: S,
  rawInput: unknown,
  fn: (ctx: Ctx<z.infer<S>>) => Promise<T>,
): Promise<ActionResult<T>> {
  const requestId = randomUUID()
  let outcome: AuditOutcome = 'error'
  let code: ActionErrorCode | undefined
  let auth: Authorized | undefined
  // Read first, so every audit line (denials and invalid input included) says who asked.
  let user: SessionUser | null = null
  let target: { account?: string; secretName?: string; versionId?: string } = rawTarget(rawInput)
  let aws: { name?: string; requestId?: string } | undefined

  try {
    user = await readSession()
    const parsed = schema.safeParse(rawInput)
    if (!parsed.success) {
      code = 'InvalidInput'
      return { ok: false, code, message: FIXED.InvalidInput }
    }
    const input = parsed.data
    target = { account: input.accountId, secretName: input.name, versionId: input.versionId }

    auth = authorize(user, input.accountId, action, getConfig().ACCOUNTS)
    const client = secretsClientFor({ account: auth.account, user: auth.user, role: auth.role })
    const data = await fn({ input, auth, client })
    outcome = 'ok'
    return { ok: true, data }
  } catch (err) {
    // Let Next's control-flow errors (redirect, notFound, forbidden) through untouched.
    unstable_rethrow(err)
    if (err instanceof AuthzError) {
      outcome = 'denied'
      code = err.code
      // NotFound for "no role in this account" is indistinguishable from an unknown account.
      const message =
        err.code === 'Forbidden'
          ? `This action requires ${err.requiredRole}.`
          : err.code === 'NotFound'
            ? DOMAIN_MESSAGES.NotFound
            : FIXED.Unauthenticated
      return { ok: false, code, message }
    }
    if (err instanceof DomainError) {
      code = err.code
      aws = { name: err.diagnostics.awsName, requestId: err.diagnostics.requestId }
      return { ok: false, code, message: DOMAIN_MESSAGES[err.code] }
    }
    code = 'Internal'
    logger.error(
      { event: 'action_failed', action, requestId, ...errorFields(err) },
      'action failed',
    )
    return { ok: false, code, message: FIXED.Internal }
  } finally {
    // The user's actual tier in the target account, when they have one (e.g. on Forbidden).
    const tier: Role | undefined =
      auth?.role ?? (user && target.account ? user.roles[target.account] : undefined)
    audit({
      action,
      outcome,
      requestId,
      user: user ? { oid: user.oid, upn: user.upn } : undefined,
      account: target.account,
      tier,
      secretName: target.secretName,
      versionId: target.versionId,
      code,
      aws,
    })
  }
}
