'use client'

import { InfoIcon, SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ActivityEvent } from '@/lib/aws/activity'
import { matchesText } from '@/lib/ui/activity-options'
import { ActivityTable } from './activity-table'

/**
 * Search + table. User / secret search runs over the events already loaded (allow-listed fields
 * only), so typing never calls AWS.
 */
export function ActivityView({
  accountId,
  events,
  loaded,
  now,
  emptyText,
  olderLink,
}: {
  accountId: string
  events: ActivityEvent[]
  /** Total events loaded (before the type filter), for "Showing X of N". */
  loaded: number
  now: number
  emptyText: string
  olderLink: React.ReactNode
}) {
  const [user, setUser] = useState('')
  const [secret, setSecret] = useState('')
  const shown = useMemo(
    () => events.filter((e) => matchesText(e, user, secret)),
    [events, user, secret],
  )
  const search = (label: string, value: string, set: (v: string) => void, mono?: boolean) => (
    <label className="flex h-10 w-[280px] items-center gap-2.5 rounded-lg border bg-card px-3 text-placeholder focus-within:ring-2 focus-within:ring-ring/40">
      <SearchIcon className="size-4 shrink-0" />
      <input
        type="search"
        value={value}
        onChange={(e) => set(e.target.value)}
        aria-label={`Filter by ${label.toLowerCase()}`}
        placeholder={label}
        className={`min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none ${mono ? 'font-mono' : ''}`}
      />
    </label>
  )

  return (
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2.5 border-b px-5 py-4">
        {search('User', user, setUser)}
        {search('Secret name', secret, setSecret, true)}
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground">
          Showing <strong className="text-foreground">{shown.length}</strong> of {loaded} loaded
          events
        </span>
      </div>
      {shown.length ? (
        <ActivityTable accountId={accountId} events={shown} now={now} />
      ) : (
        <div className="px-5 py-14 text-center text-sm text-muted-foreground">
          {user || secret ? 'No loaded events match this user or secret. ' : ''}
          {emptyText}
        </div>
      )}
      <div className="flex items-center gap-2.5 border-t bg-sunken px-5 py-3.5 text-[13px] text-muted-foreground">
        <InfoIcon className="size-4 shrink-0" />
        <span>
          Attempts the app blocks (for example a reader trying to delete) never reach AWS. They’re
          in the app’s audit log, not here.
        </span>
        <div className="flex-1" />
        {olderLink}
      </div>
    </section>
  )
}
