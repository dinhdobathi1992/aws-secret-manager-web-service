/** Pure display helpers shared by server and client components. No secret data passes here. */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function relativeTime(iso: string | undefined, now = Date.now()): string {
  if (!iso) return '—'
  const diff = now - new Date(iso).getTime()
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return plural(Math.floor(diff / MINUTE), 'minute')
  if (diff < DAY) return plural(Math.floor(diff / HOUR), 'hour')
  if (diff < 7 * DAY) return plural(Math.floor(diff / DAY), 'day')
  if (diff < 30 * DAY) return plural(Math.floor(diff / (7 * DAY)), 'week')
  if (diff < 365 * DAY) return plural(Math.floor(diff / (30 * DAY)), 'month')
  return plural(Math.floor(diff / (365 * DAY)), 'year')
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`
}

export function absoluteDate(iso: string | undefined, withTime = false): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
    timeZone: 'UTC',
  }).format(new Date(iso))
}

export type Freshness = 'week' | 'quarter' | 'stale'

/** Short legend labels (after "Last changed:"). */
export const FRESHNESS_SHORT: Record<Freshness, string> = {
  week: 'This week',
  quarter: 'Within 90 days',
  stale: 'Older',
}

export const FRESHNESS_LABEL: Record<Freshness, string> = {
  week: 'Changed this week',
  quarter: 'Changed in the last 90 days',
  stale: 'Not changed for 90+ days',
}

export function freshness(iso: string | undefined, now = Date.now()): Freshness {
  if (!iso) return 'stale'
  const days = (now - new Date(iso).getTime()) / DAY
  if (days <= 7) return 'week'
  if (days <= 90) return 'quarter'
  return 'stale'
}

export function isRecent(iso: string | undefined, now = Date.now()): boolean {
  return freshness(iso, now) === 'week'
}

/** "team/app/db" → { path: "team/app/", leaf: "db", top: "team" } */
export function splitName(name: string): { path: string; leaf: string; top: string } {
  const i = name.lastIndexOf('/')
  const top = name.split('/')[0] || name
  return i < 0
    ? { path: '', leaf: name, top }
    : { path: name.slice(0, i + 1), leaf: name.slice(i + 1), top }
}

/** URL path for a secret: each name segment encoded, so `/`, `+`, `=`, `@` survive routing. */
export function secretHref(accountId: string, name: string, tab?: string): string {
  const segments = name.split('/')
  // URL parsers resolve "." / ".." (even percent-encoded) and collapse empty segments, which would
  // open a different secret. Such names travel as one "~"-prefixed segment ("~" is not allowed in
  // AWS names, so the marker is unambiguous) with "/" encoded as %2F.
  const path = segments.some((s) => s === '' || s === '.' || s === '..')
    ? `~${encodeURIComponent(name)}`
    : segments.map(encodeURIComponent).join('/')
  return `/a/${encodeURIComponent(accountId)}/s/${path}${tab && tab !== 'value' ? `?tab=${tab}` : ''}`
}

/** Short account id from a role ARN: 123456789012 → 1234…9012 */
export function shortAccountId(roleArn: string): string {
  const id = roleArn.split(':')[4] ?? ''
  return id.length === 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id
}

export function shortVersion(id: string | undefined): string {
  if (!id) return '—'
  return id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id
}

// A small fixed palette picked by a stable hash, so colours never need configuring.
const PALETTE = [
  'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  'bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
] as const

// Tag chips share the palette: tinted rectangles, no border.
const TAG_PALETTE = PALETTE

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function prefixColor(top: string): string {
  return PALETTE[hash(top) % PALETTE.length]
}

export function tagColor(key: string): string {
  return TAG_PALETTE[hash(key) % TAG_PALETTE.length]
}

/**
 * Request time for server components. They render once per request, so this is stable for the
 * render; client components must not use it during render.
 */
export function requestTime(): number {
  return Date.now()
}

/** List page sizes (AWS ListSecrets MaxResults). Kept out of client modules so server pages can read it. */
export const PAGE_SIZES = [25, 50, 100] as const

/**
 * Inverse of secretHref for catch-all params. Next 16 passes segments still percent-encoded;
 * AWS names can't contain '%', so decoding is unambiguous. Malformed input returns null (404).
 */
export function secretNameFromSegments(segments: string[]): string | null {
  try {
    if (segments.length === 1 && segments[0].startsWith('~')) {
      return decodeURIComponent(segments[0].slice(1))
    }
    return segments.map(decodeURIComponent).join('/')
  } catch {
    return null
  }
}

/**
 * Estimated permanent-deletion date for a secret scheduled for deletion. AWS DeletedDate is the
 * time deletion was requested (checked on real AWS), so add the recovery window.
 */
export function deletionEstimate(
  deletedDate: string | undefined,
  windowDays: number,
  now: number,
): { deletesAt: string; daysLeft: number } | null {
  if (!deletedDate) return null
  const at = new Date(deletedDate).getTime() + windowDays * 86_400_000
  return {
    deletesAt: new Date(at).toISOString(),
    daysLeft: Math.max(0, Math.ceil((at - now) / 86_400_000)),
  }
}
