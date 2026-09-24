'use client'

import { SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import type { ActivityEvent } from '@/lib/aws/activity'
import { matchesText } from '@/lib/ui/activity-options'
import { ActivityFilters } from './activity-filters'
import { ActivityTable } from './activity-table'

/**
 * Filters + table. User / secret search runs over the events already loaded (allow-listed
 * fields only), so typing never calls AWS.
 */
export function ActivityView({
  accountId,
  events,
  now,
  emptyText,
  footer,
}: {
  accountId: string
  events: ActivityEvent[]
  now: number
  emptyText: string
  footer: React.ReactNode
}) {
  const [user, setUser] = useState('')
  const [secret, setSecret] = useState('')
  const shown = useMemo(
    () => events.filter((e) => matchesText(e, user, secret)),
    [events, user, secret],
  )

  return (
    <>
      <ActivityFilters>
        <label className="relative flex w-[220px] items-center">
          <SearchIcon className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
          <Input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            aria-label="Filter by user"
            placeholder="User"
            className="h-8 bg-card pl-8 text-[13px]"
          />
        </label>
        <label className="relative flex w-[240px] items-center">
          <SearchIcon className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
          <Input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            aria-label="Filter by secret name"
            placeholder="Secret name"
            className="h-8 bg-card pl-8 font-mono text-[13px]"
          />
        </label>
      </ActivityFilters>
      <div className="overflow-hidden rounded-xl border bg-card">
        {shown.length ? (
          <ActivityTable accountId={accountId} events={shown} now={now} />
        ) : (
          <div className="px-5 py-14 text-center text-sm text-muted-foreground">
            {user || secret ? 'No loaded events match this user or secret. ' : ''}
            {emptyText}
          </div>
        )}
        {footer}
      </div>
    </>
  )
}
