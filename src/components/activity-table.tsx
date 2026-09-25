'use client'

import {
  ChevronDownIcon,
  CircleCheckIcon,
  CircleXIcon,
  EyeOffIcon,
  MonitorIcon,
  TerminalIcon,
} from 'lucide-react'
import Link from 'next/link'
import { Fragment, useState } from 'react'
import type { ActivityEvent } from '@/lib/aws/activity'
import { relativeTime, secretHref, shortVersion } from '@/lib/ui/format'
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

const dayFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

function initial(who: string) {
  return (who.replace(/[^A-Za-z0-9]/g, '')[0] ?? '?').toUpperCase()
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
    'h-10 px-4 text-left text-[11px] font-semibold tracking-[.06em] text-muted-foreground uppercase'
  // A day header row precedes the first event of each UTC day.
  const rows = events.map((e, i) => {
    const day = dayFmt.format(new Date(e.time))
    const prev = i > 0 ? dayFmt.format(new Date(events[i - 1].time)) : ''
    return { e, day, header: day !== prev }
  })
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead className="bg-sunken">
        <tr>
          <th className={cn(th, 'w-[150px]')}>Time (UTC)</th>
          <th className={cn(th, 'w-[320px]')}>Who</th>
          <th className={cn(th, 'w-[150px]')}>Action</th>
          <th className={th}>Secret</th>
          <th className={cn(th, 'w-[150px]')}>Result</th>
          <th className={cn(th, 'w-[52px]')}>
            <span className="sr-only">Details</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ e, day, header }) => {
          const isOpen = open === e.id
          return (
            <Fragment key={e.id}>
              {header && (
                <tr>
                  <td
                    colSpan={6}
                    className="border-t bg-card px-4 py-2 text-xs font-semibold text-muted-foreground"
                  >
                    {day}
                  </td>
                </tr>
              )}
              <tr className={cn('h-14 border-t hover:bg-muted/30', isOpen && 'bg-sunken')}>
                <td className="px-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono">{timeFmt.format(new Date(e.time))}</span>
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(e.time, now)}
                    </span>
                  </div>
                </td>
                <td className="px-4">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                      {initial(e.who)}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium">{e.who}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {e.viaApp ? (
                          <MonitorIcon className="size-3" />
                        ) : (
                          <TerminalIcon className="size-3" />
                        )}
                        via {e.viaApp ? 'Secrets Console' : 'AWS console / CLI'}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4">
                  <span
                    className={cn(
                      'inline-flex h-5 items-center rounded-[5px] px-[7px] text-xs font-semibold tracking-[.03em]',
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
                      className="font-mono underline decoration-muted-foreground/50 underline-offset-[3px] hover:decoration-foreground"
                    >
                      {e.secretName}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4">
                  {e.errorCode ? (
                    <span className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
                      <CircleXIcon className="size-3.5" />
                      {e.errorCode}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <CircleCheckIcon className="size-3.5 text-green-600 dark:text-green-500" />
                      Success
                    </span>
                  )}
                </td>
                <td className="px-3 text-right">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-label={`Details for ${e.label} ${e.secretName ?? ''}`}
                    onClick={() => setOpen(isOpen ? null : e.id)}
                    className="inline-flex size-7 items-center justify-center rounded-[7px] text-muted-foreground hover:bg-muted"
                  >
                    <ChevronDownIcon
                      className={cn('size-4 transition-transform', isOpen && 'rotate-180')}
                    />
                  </button>
                </td>
              </tr>
              {isOpen && (
                <tr className="bg-sunken">
                  <td colSpan={6} className="px-4 pt-1 pb-4">
                    <div className="flex flex-col gap-3 rounded-[10px] border bg-background px-4 py-3.5">
                      <dl className="grid grid-cols-5 gap-4">
                        {(
                          [
                            ['AWS event', e.eventName],
                            ['Request id', e.requestId ?? '—'],
                            ['Version', shortVersion(e.versionId)],
                            ['Role session', e.roleSession ?? '—'],
                            ['Source IP', e.sourceIp ?? '—'],
                          ] as const
                        ).map(([label, value]) => (
                          <div key={label} className="flex min-w-0 flex-col gap-1">
                            <dt className="text-[11px] font-semibold tracking-[.06em] text-muted-foreground uppercase">
                              {label}
                            </dt>
                            <dd className="truncate font-mono text-[13px]" title={value}>
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <EyeOffIcon className="size-3.5" />
                        Secret values are never recorded in CloudTrail.
                      </p>
                    </div>
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
