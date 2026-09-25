import Link from 'next/link'
import type { AccountOption } from '@/lib/data/page-data'
import { cn } from '@/lib/utils'

/** "AWS account" card on the Secrets page: one button per account where the user has a role. */
export function AccountPicker({
  accounts,
  currentId,
}: {
  accounts: AccountOption[]
  currentId: string
}) {
  return (
    <section
      aria-label="AWS account"
      className="surface flex flex-wrap items-center gap-4 px-5 py-4"
    >
      <span className="text-sm font-medium text-label">AWS account</span>
      <div className="flex flex-wrap gap-2.5">
        {accounts.map((a) => {
          const on = a.id === currentId
          return (
            <Link
              key={a.id}
              href={`/a/${encodeURIComponent(a.id)}`}
              aria-current={on ? 'true' : undefined}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-medium',
                on
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border-strong bg-card text-label hover:bg-sunken',
              )}
            >
              {a.name}
              <span className="font-mono text-xs opacity-80">{a.shortId}</span>
              <span
                className={cn(
                  'inline-flex h-[18px] items-center rounded-[5px] px-1.5 text-[11px] font-semibold uppercase',
                  on ? 'bg-white/20' : 'bg-muted text-muted-foreground',
                )}
              >
                {a.role}
              </span>
            </Link>
          )
        })}
      </div>
      <div className="flex-1" />
      <span className="text-[13px] text-muted-foreground">
        Only accounts where you have a role are listed.
      </span>
    </section>
  )
}
