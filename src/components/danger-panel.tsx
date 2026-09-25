'use client'

import { Trash2Icon, TriangleAlertIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { deleteSecret } from '@/lib/actions/secrets'
import { cn } from '@/lib/utils'
import { RoleBadge } from './role-badge'

export function DangerPanel({
  accountId,
  name,
  lastAccessed,
  goneBy,
  recoveryDays,
}: {
  accountId: string
  name: string
  /** Formatted last-accessed date from AWS, when known. */
  lastAccessed?: string
  /** Formatted estimate of the permanent-deletion date if deleted now. */
  goneBy: string
  recoveryDays: number
}) {
  const router = useRouter()
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const matches = typed === name

  const remove = () =>
    startTransition(async () => {
      const res = await deleteSecret({ accountId, name })
      if (!res.ok) return setError(res.message)
      toast.success(`${name} is scheduled for deletion in ${recoveryDays} days.`)
      router.push(`/a/${encodeURIComponent(accountId)}/deleted`)
    })

  const fact = (label: string, value: string) => (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-[.06em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )

  return (
    <section
      aria-labelledby="del-title"
      className="w-full max-w-[800px] overflow-hidden rounded-xl border border-red-300 bg-card dark:border-red-900"
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
            <Trash2Icon className="size-4" />
          </span>
          <h2 id="del-title" className="text-base font-semibold">
            Delete this secret
          </h2>
          <RoleBadge role="admin" />
        </div>
        <div className="grid grid-cols-3 gap-4 rounded-[10px] border bg-sunken px-4 py-3.5">
          {fact('Takes effect', 'Immediately. Apps reading it fail')}
          {fact('Recovery window', `${recoveryDays} days, from Scheduled deletion`)}
          {fact('Gone for good', `About ${goneBy}`)}
        </div>
        {lastAccessed && (
          <div
            role="note"
            className="flex gap-2.5 rounded-[10px] border border-amber-300 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/45 dark:text-amber-200"
          >
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            <span>
              AWS reports this secret was last accessed on <strong>{lastAccessed}</strong>.
              Something may still read it. Check with its owners first.
            </span>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm-name" className="text-[13px] font-medium">
            Type <span className="rounded-[5px] bg-muted px-1.5 py-px font-mono">{name}</span> to
            confirm
          </label>
          <input
            id="confirm-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="h-9 w-full max-w-[460px] rounded-lg border bg-background px-2.5 font-mono text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <span
            className={cn(
              'text-xs',
              matches ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
            )}
          >
            {typed === ''
              ? 'Type the full name, exactly.'
              : matches
                ? 'Name matches.'
                : 'Doesn’t match yet'}
          </span>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-red-200 bg-red-50/60 px-6 py-3.5 dark:border-red-950 dark:bg-red-950/25">
        <Button
          className={cn(
            'h-[34px]',
            matches ? 'bg-red-700 text-white hover:bg-red-800' : 'bg-muted text-muted-foreground',
          )}
          disabled={!matches || pending}
          onClick={remove}
        >
          <Trash2Icon />
          {pending ? 'Scheduling…' : 'Schedule deletion'}
        </Button>
        <span className="text-xs text-muted-foreground">
          Enabled once the name matches exactly.
        </span>
      </div>
    </section>
  )
}
