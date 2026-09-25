'use client'

import {
  ChevronDownIcon,
  CircleCheckIcon,
  CircleXIcon,
  EyeIcon,
  EyeOffIcon,
  HistoryIcon,
  type LucideIcon,
  MonitorIcon,
  PencilLineIcon,
  PlusIcon,
  RotateCcwIcon,
  TagIcon,
  TerminalIcon,
  Trash2Icon,
} from 'lucide-react'
import Link from 'next/link'
import { Fragment, useState } from 'react'
import type { ActivityEvent } from '@/lib/aws/activity'
import { groupActivity } from '@/lib/ui/activity-options'
import { relativeTime, secretHref, shortVersion } from '@/lib/ui/format'
import { cn } from '@/lib/utils'

const ACTION: Record<string, { style: string; icon: LucideIcon }> = {
  View: { style: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300', icon: EyeIcon },
  'View (batch)': {
    style: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    icon: EyeIcon,
  },
  'Update value': {
    style: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    icon: PencilLineIcon,
  },
  Update: {
    style: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    icon: PencilLineIcon,
  },
  Create: {
    style: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
    icon: PlusIcon,
  },
  Delete: { style: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300', icon: Trash2Icon },
  Restore: {
    style: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
    icon: RotateCcwIcon,
  },
  Rollback: {
    style: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
    icon: HistoryIcon,
  },
}
const OTHER = {
  style: 'bg-gray-100 text-gray-700 dark:bg-muted dark:text-foreground/80',
  icon: TagIcon,
}

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
    'h-11 px-5 text-left text-xs font-semibold tracking-[.04em] text-muted-foreground uppercase'
  const td = 'border-t border-[#eef0f3] px-5 dark:border-border'
  const days = groupActivity(events)
  return (
    <table className="w-full border-collapse text-sm">
      <thead className="bg-sunken">
        <tr>
          <th className={cn(th, 'w-[170px]')}>Time (UTC)</th>
          <th className={th}>Event</th>
          <th className={cn(th, 'w-[250px]')}>Who</th>
          <th className={cn(th, 'w-[160px]')}>Source</th>
          <th className={cn(th, 'w-[130px]')}>Result</th>
          <th className={cn(th, 'w-[52px]')}>
            <span className="sr-only">Details</span>
          </th>
        </tr>
      </thead>
      {days.map(({ day, total, rows }) => (
        <tbody key={day}>
          <tr>
            <td colSpan={6} className="border-t px-5 py-2.5 text-[13px] font-semibold text-label">
              {day}{' '}
              <span className="font-normal text-muted-foreground">
                · {total} {total === 1 ? 'event' : 'events'}
              </span>
            </td>
          </tr>
          {rows.map(({ e, count }) => {
            const isOpen = open === e.id
            const action = ACTION[e.label] ?? OTHER
            const Icon = action.icon
            return (
              <Fragment key={e.id}>
                <tr
                  className={cn(
                    'h-[58px]',
                    e.label === 'Delete' && 'bg-red-50/70 dark:bg-red-950/20',
                    isOpen && 'bg-sunken',
                  )}
                >
                  <td className={td}>
                    <div className="flex items-baseline gap-2">
                      <span className="tabular text-[15px] font-semibold text-foreground">
                        {timeFmt.format(new Date(e.time))}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {relativeTime(e.time, now)}
                      </span>
                    </div>
                  </td>
                  <td className={td}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          'inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold whitespace-nowrap',
                          action.style,
                        )}
                      >
                        <Icon className="size-3.5" />
                        {e.label}
                      </span>
                      {e.secretName ? (
                        <Link
                          href={secretHref(accountId, e.secretName)}
                          className="truncate font-mono font-semibold text-foreground hover:underline"
                        >
                          {e.secretName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {count > 1 && (
                        <span
                          className="shrink-0 rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground"
                          title={`${count} identical events in this minute`}
                        >
                          ×{count}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={td}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                          e.viaApp
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
                        )}
                      >
                        {initial(e.who)}
                      </span>
                      <span className="truncate font-medium text-label" title={e.who}>
                        {e.who}
                      </span>
                    </div>
                  </td>
                  <td className={td}>
                    {e.viaApp ? (
                      <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-medium whitespace-nowrap text-label">
                        <MonitorIcon className="size-3" />
                        Secrets Console
                      </span>
                    ) : (
                      <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-amber-100 px-2.5 text-xs font-semibold whitespace-nowrap text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        <TerminalIcon className="size-3" />
                        Outside app
                      </span>
                    )}
                  </td>
                  <td className={td}>
                    {e.errorCode ? (
                      <span className="inline-flex h-6 max-w-full items-center gap-1.5 truncate rounded-md bg-red-100 px-2 text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-300">
                        <CircleXIcon className="size-3.5 shrink-0" />
                        {e.errorCode}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                        <CircleCheckIcon className="size-3.5" />
                        Success
                      </span>
                    )}
                  </td>
                  <td className={cn(td, 'px-3 text-right')}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-label={`Details for ${e.label} ${e.secretName ?? ''}`}
                      onClick={() => setOpen(isOpen ? null : e.id)}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                    >
                      <ChevronDownIcon
                        className={cn('size-4 transition-transform', isOpen && 'rotate-180')}
                      />
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-sunken">
                    <td colSpan={6} className="px-5 pt-1 pb-4">
                      <div className="flex flex-col gap-3 rounded-lg border bg-card px-4 py-3.5">
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
                              <dt className="text-xs font-semibold tracking-[.04em] text-muted-foreground uppercase">
                                {label}
                              </dt>
                              <dd
                                className="truncate font-mono text-[13px] text-foreground"
                                title={value}
                              >
                                {value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <EyeOffIcon className="size-3.5" />
                          Secret values are never recorded in CloudTrail.
                          {count > 1 && ` Showing the newest of ${count} identical events.`}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      ))}
    </table>
  )
}
