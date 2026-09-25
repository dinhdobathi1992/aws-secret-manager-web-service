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
      <span className="text-xs font-semibold tracking-[.04em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )

  return (
    <section
      aria-labelledby="del-title"
      className="surface w-full max-w-[800px] overflow-hidden border border-red-200 dark:border-red-900"
    >
      <div className="flex flex-col gap-[18px] px-7 py-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-[38px] items-center justify-center rounded-[10px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
            <Trash2Icon className="size-[18px]" />
          </span>
          <h2 id="del-title" className="text-lg font-semibold text-foreground">
            Delete this secret
          </h2>
          <RoleBadge role="admin" />
        </div>
        <div className="grid grid-cols-3 gap-4 rounded-lg border bg-sunken px-[18px] py-4">
          {fact('Takes effect', 'Immediately. Apps reading it fail')}
          {fact('Recovery window', `${recoveryDays} days, from Scheduled deletion`)}
          {fact('Gone for good', `About ${goneBy}`)}
        </div>
        {lastAccessed && (
          <div
            role="note"
            className="flex gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/45 dark:text-amber-200"
          >
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            <span>
              AWS reports this secret was last accessed on <strong>{lastAccessed}</strong>.
              Something may still read it. Check with its owners first.
            </span>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm-name" className="text-sm font-medium text-label">
            Type{' '}
            <span className="rounded-[5px] bg-muted px-1.5 py-0.5 font-mono text-foreground">
              {name}
            </span>{' '}
            to confirm
          </label>
          <input
            id="confirm-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="h-10 w-full max-w-[460px] rounded-lg border bg-card px-3 font-mono text-[13px] text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          <span
            className={cn(
              'text-[13px]',
              matches ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground',
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
      <div className="flex items-center gap-3 border-t border-red-100 bg-red-50 px-7 py-4 dark:border-red-950 dark:bg-red-950/25">
        <Button
          variant={matches ? 'destructive' : 'secondary'}
          className={cn('h-10', !matches && 'border border-border text-placeholder')}
          disabled={!matches || pending}
          onClick={remove}
        >
          <Trash2Icon />
          {pending ? 'Scheduling…' : 'Schedule deletion'}
        </Button>
        <span className="text-[13px] text-muted-foreground">
          Enabled once the name matches exactly.
        </span>
      </div>
    </section>
  )
}
