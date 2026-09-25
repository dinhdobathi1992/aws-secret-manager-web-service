import { LockIcon } from 'lucide-react'
import type { Role } from '@/lib/auth/rbac'

/** 403 in place: names the required tier and the user's own tier only, never group ids. */
export function ForbiddenState({
  requiredRole,
  currentRole,
}: {
  requiredRole: Role
  currentRole?: Role
}) {
  return (
    <div className="flex max-w-xl flex-col items-start gap-3 surface p-8">
      <LockIcon className="size-7 text-muted-foreground" />
      <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[11px] font-semibold">
        403
      </span>
      <h2 className="text-xl font-semibold">This action requires {requiredRole}</h2>
      <p className="text-sm text-muted-foreground">
        {currentRole ? `Your role in this account is ${currentRole}. ` : ''}Ask an account admin if
        you need more access.
      </p>
    </div>
  )
}
