import { ACTION_MIN_ROLE, can, ROLES, type Action, type Role } from '@/lib/auth/rbac'

/** Secrets Manager API calls each app action needs. */
const ACTION_API: Record<Action, string[]> = {
  list: ['secretsmanager:ListSecrets'],
  view: ['secretsmanager:DescribeSecret', 'secretsmanager:ListSecretVersionIds'],
  reveal: ['secretsmanager:GetSecretValue'],
  // Tagging on create needs TagResource too.
  create: ['secretsmanager:CreateSecret', 'secretsmanager:TagResource'],
  update: ['secretsmanager:PutSecretValue'],
  tag: ['secretsmanager:TagResource', 'secretsmanager:UntagResource'],
  delete: ['secretsmanager:DeleteSecret'],
  restore: ['secretsmanager:RestoreSecret'],
  rollback: ['secretsmanager:UpdateSecretVersionStage'],
}

function kmsActions(role: Role): string[] {
  // Reading a CMK-encrypted secret needs Decrypt; writing a new version needs GenerateDataKey.
  return can(role, 'update') ? ['kms:Decrypt', 'kms:GenerateDataKey'] : ['kms:Decrypt']
}

export function apiActionsFor(role: Role): string[] {
  const actions = (Object.keys(ACTION_MIN_ROLE) as Action[])
    .filter((a) => can(role, a))
    .flatMap((a) => ACTION_API[a])
  return [...new Set(actions)].sort()
}

/**
 * STS session policy per tier. The effective permission is the intersection with the target
 * role's policy, so an app authorization bug can't exceed the user's tier in IAM. Derived from
 * ACTION_MIN_ROLE, the same table the app checks.
 */
export function sessionPolicyFor(role: Role): string {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      { Effect: 'Allow', Action: apiActionsFor(role), Resource: '*' },
      {
        Effect: 'Allow',
        Action: kmsActions(role),
        Resource: '*',
        Condition: { StringLike: { 'kms:ViaService': 'secretsmanager.*.amazonaws.com' } },
      },
    ],
  })
}

export const TIER_SESSION_POLICY: Record<Role, string> = Object.fromEntries(
  ROLES.map((r) => [r, sessionPolicyFor(r)]),
) as Record<Role, string>
