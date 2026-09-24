import { cn } from '@/lib/utils'
import type { Role } from '@/lib/auth/rbac'

const STYLE: Record<Role, string> = {
  reader: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  writer: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  admin: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
}

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold tracking-wide uppercase',
        STYLE[role],
        className,
      )}
    >
      {role}
    </span>
  )
}
