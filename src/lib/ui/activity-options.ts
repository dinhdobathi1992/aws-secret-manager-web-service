import type { ActivityEvent } from '@/lib/aws/activity'

export const ACTIVITY_RANGES = [
  { id: '1d', label: 'Last 24 hours', days: 1 },
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '90d', label: 'Last 90 days', days: 90 },
] as const

export const ACTIVITY_TYPES = [
  { id: 'changes', label: 'Changes & reveals' },
  { id: 'reveals', label: 'Reveals only' },
  { id: 'failed', label: 'Failed' },
  { id: 'all', label: 'All incl. list/describe' },
] as const

export type ActivityType = (typeof ACTIVITY_TYPES)[number]['id']

export function parseActivityType(v: string | undefined): ActivityType {
  return ACTIVITY_TYPES.find((t) => t.id === v)?.id ?? 'changes'
}

/** Event-type filter. Applied on the server, where it also decides how many pages to fetch. */
export function matchesType(e: ActivityEvent, type: ActivityType): boolean {
  if (type === 'reveals') return e.kind === 'reveal'
  if (type === 'failed') return !!e.errorCode
  if (type === 'changes') return e.kind !== 'read'
  return true
}

/** User / secret text filter. Applied in the browser over loaded events: no AWS call per keystroke. */
export function matchesText(e: ActivityEvent, user?: string, secret?: string): boolean {
  const u = user?.trim().toLowerCase()
  const s = secret?.trim().toLowerCase()
  if (u && !e.who.toLowerCase().includes(u)) return false
  if (s && !e.secretName?.toLowerCase().includes(s)) return false
  return true
}

export type ActivityFilter = { type: string; user?: string; secret?: string }

export function filterActivity(events: ActivityEvent[], f: ActivityFilter): ActivityEvent[] {
  const type = parseActivityType(f.type)
  return events.filter((e) => matchesType(e, type) && matchesText(e, f.user, f.secret))
}

const DAY_MS = 86_400_000

/**
 * The CloudTrail query window. A NextToken is only valid with the original StartTime/EndTime,
 * so "older" pages reuse the first page's end (carried in the URL); anything else starts fresh.
 */
export function activityWindow(
  now: number,
  rangeDays: number,
  cursor: string | undefined,
  endParam: string | undefined,
): { start: Date; end: Date; nextToken?: string; end0: number } {
  const pinned = Number(endParam)
  const valid = !!cursor && Number.isFinite(pinned) && pinned <= now && pinned > now - 90 * DAY_MS
  const end = valid ? pinned : now
  return {
    start: new Date(end - rangeDays * DAY_MS),
    end: new Date(end),
    nextToken: valid ? cursor : undefined,
    end0: end,
  }
}
