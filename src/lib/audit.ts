import type { Action, Role } from '@/lib/auth/rbac'
import { logger } from '@/lib/logger'

export type AuditOutcome = 'ok' | 'denied' | 'error'

export type AuditEvent = {
  action: Action
  outcome: AuditOutcome
  requestId: string
  user?: { oid: string; upn: string }
  account?: string
  tier?: Role
  secretName?: string
  versionId?: string
  code?: string
  aws?: { name?: string; requestId?: string }
}

const auditLogger = logger.child({ type: 'audit' })

/**
 * Writes one audit line. The record is rebuilt field by field from the allow-list above and
 * never spreads caller objects, so a secret value can't ride along.
 */
export function audit(e: AuditEvent): void {
  auditLogger.info(
    {
      action: e.action,
      outcome: e.outcome,
      requestId: e.requestId,
      ts: new Date().toISOString(),
      ...(e.user ? { user: { oid: e.user.oid, upn: e.user.upn } } : {}),
      ...(e.account ? { account: e.account } : {}),
      ...(e.tier ? { tier: e.tier } : {}),
      ...(e.secretName ? { secretName: e.secretName } : {}),
      ...(e.versionId ? { versionId: e.versionId } : {}),
      ...(e.code ? { code: e.code } : {}),
      ...(e.aws?.name || e.aws?.requestId
        ? { aws: { name: e.aws.name, requestId: e.aws.requestId } }
        : {}),
    },
    'audit',
  )
}
