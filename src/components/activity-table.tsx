'use client'

import { ChevronDownIcon } from 'lucide-react'
import Link from 'next/link'
import { Fragment, useState } from 'react'
import type { ActivityEvent } from '@/lib/aws/activity'
import { absoluteDate, relativeTime, secretHref, shortVersion } from '@/lib/ui/format'
import { cn } from '@/lib/utils'

const ACTION_STYLE: Record<string, string> = {
  Reveal: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  'Reveal (batch)': 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  'Update value': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  Update: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  Create: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  Delete: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  Restore: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  Rollback: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
}

function initials(who: string) {
  const base = who.split('@')[0].replace(/[^A-Za-z0-9.\-_ ]/g, '')
  const parts = base.split(/[.\-_ ]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function ActivityTable({
  accountId,
  events,
  now,
}: {
  accountId: string
  events: ActivityEvent[]
  now: number
}) {
  const [open, setOpen] = useState<string | null>(null)
  const th =
    'h-10 px-4 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase'
  return (
    <table className="w-full border-collapse">
      <thead className="border-b bg-muted/40">
        <tr>
          <th className={cn(th, 'w-[16%] pl-5')}>Time</th>
          <th className={cn(th, 'w-[26%]')}>Who</th>
          <th className={cn(th, 'w-[14%]')}>Action</th>
          <th className={th}>Secret</th>
          <th className={cn(th, 'w-[14%]')}>Result</th>
          <th className={cn(th, 'w-11')}>
            <span className="sr-only">Details</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {events.map((e) => {
          const isOpen = open === e.id
          return (
            <Fragment key={e.id}>
              <tr className="border-b border-border/60 hover:bg-muted/40">
                <td className="py-3 pr-4 pl-5">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{relativeTime(e.time, now)}</span>
                    <span className="text-xs text-muted-foreground">
                      {absoluteDate(e.time, true)} UTC
                    </span>
                  </div>
                </td>
                <td className="px-4">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                      {initials(e.who)}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-[13px] font-medium">{e.who}</span>
                      <span className="text-[11px] text-muted-foreground">
                        via {e.viaApp ? 'Secrets Console' : 'AWS console / CLI'}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4">
                  <span
                    className={cn(
                      'inline-flex h-[22px] items-center rounded-md px-2 text-xs font-semibold',
                      ACTION_STYLE[e.label] ?? 'bg-muted text-foreground/80',
                    )}
                  >
                    {e.label}
                  </span>
                </td>
                <td className="px-4">
                  {e.secretName ? (
                    <Link
                      href={secretHref(accountId, e.secretName)}
                      className="font-mono text-[13px] hover:text-blue-700 dark:hover:text-blue-400"
                    >
                      {e.secretName}
                    </Link>
                  ) : (
                    <span className="text-[13px] text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4">
                  {e.errorCode ? (
                    <span className="inline-flex items-center gap-1.5 text-[13px] text-red-700 dark:text-red-400">
                      <span className="size-2 rounded-full bg-red-600" />
                      {e.errorCode}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[13px] text-green-700 dark:text-green-400">
                      <span className="size-2 rounded-full bg-green-600" />
                      Success
                    </span>
                  )}
                </td>
                <td className="pr-3">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-label={`Details for ${e.label} ${e.secretName ?? ''}`}
                    onClick={() => setOpen(isOpen ? null : e.id)}
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  >
                    <ChevronDownIcon
                      className={cn('size-4 transition-transform', isOpen && 'rotate-180')}
                    />
                  </button>
                </td>
              </tr>
              {isOpen && (
                <tr className="border-b border-border/60 bg-muted/30">
                  <td colSpan={6} className="py-3.5 pr-5 pl-[58px]">
                    <dl className="grid grid-cols-[150px_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs">
                      <dt className="text-muted-foreground">AWS event</dt>
                      <dd className="font-mono">{e.eventName}</dd>
                      <dt className="text-muted-foreground">AWS request id</dt>
                      <dd className="font-mono">{e.requestId ?? '—'}</dd>
                      <dt className="text-muted-foreground">Version</dt>
                      <dd className="font-mono" title={e.versionId}>
                        {shortVersion(e.versionId)}
                      </dd>
                      <dt className="text-muted-foreground">Role session</dt>
                      <dd className="font-mono">{e.roleSession ?? '—'}</dd>
                      <dt className="text-muted-foreground">Source IP</dt>
                      <dd className="font-mono">{e.sourceIp ?? '—'}</dd>
                    </dl>
                    <p className="mt-2.5 text-xs text-muted-foreground">
                      Values are never part of CloudTrail events or this page.
                    </p>
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}
