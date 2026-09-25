import {
  ActivityIcon,
  AlertTriangleIcon,
  EyeIcon,
  PencilLineIcon,
  RotateCcwIcon,
} from 'lucide-react'
import Link from 'next/link'
import { ActivityRange } from '@/components/activity-range'
import { ActivityView } from '@/components/activity-view'
import { AwsErrorState } from '@/components/aws-error-state'
import { ForbiddenState } from '@/components/forbidden-state'
import { RoleBadge } from '@/components/role-badge'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/auth/rbac'
import { lookupActivity } from '@/lib/aws/activity'
import { cloudTrailClientFor } from '@/lib/aws/assume-role'
import { load, pageContext } from '@/lib/data/page-data'
import {
  ACTIVITY_RANGES,
  ACTIVITY_TYPES,
  activityWindow,
  matchesType,
  parseActivityType,
  type ActivityType,
} from '@/lib/ui/activity-options'
import { requestTime } from '@/lib/ui/format'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type RawSearch = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function FilterTile({
  href,
  on,
  label,
  value,
  sub,
  icon,
}: {
  href: string
  on: boolean
  label: string
  value: string
  sub: string
  icon?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={on ? 'true' : undefined}
      className={cn(
        'flex flex-col gap-1.5 rounded-xl border bg-card px-4 py-3.5 text-left transition-colors hover:border-foreground/40',
        on && 'border-foreground ring-1 ring-foreground ring-inset',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'text-[13px] font-medium',
            on ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {label}
        </span>
        {icon}
      </span>
      <span className="text-2xl leading-none font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </Link>
  )
}

const tileIcon = (tint: string, icon: React.ReactNode) => (
  <span className={cn('inline-flex size-7 items-center justify-center rounded-[7px]', tint)}>
    {icon}
  </span>
)

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ account: string }>
  searchParams: Promise<RawSearch>
}) {
  const { account } = await params
  const raw = await searchParams
  const { auth } = await pageContext(account, 'list')
  // Admin-only; others get an in-place 403 naming the tier (the header link is hidden for them).
  if (!can(auth.role, 'activity'))
    return <ForbiddenState requiredRole="admin" currentRole={auth.role} />

  const range = ACTIVITY_RANGES.find((r) => r.id === one(raw.range)) ?? ACTIVITY_RANGES[1]
  const type = parseActivityType(one(raw.type))
  const now = requestTime()
  const cursor = one(raw.cursor)
  const win = activityWindow(now, range.days, cursor, one(raw.end))
  const end = win.end0
  const client = cloudTrailClientFor({ account: auth.account, user: auth.user, role: auth.role })
  const result = await load(() =>
    lookupActivity(client, auth.account.roleArn, {
      start: win.start,
      end: win.end,
      nextToken: win.nextToken,
      match: (e) => matchesType(e, type),
    }),
  )

  const keepBase = Object.fromEntries(
    Object.entries(raw).flatMap(([k, v]) =>
      one(v) && !['cursor', 'end', 'type'].includes(k) ? [[k, one(v)!]] : [],
    ),
  )
  const typeHref = (t: ActivityType) => {
    const q = new URLSearchParams({
      ...keepBase,
      ...(t === 'changes' ? {} : { type: t }),
    }).toString()
    return q ? `?${q}` : '?'
  }
  const newestHref = `?${new URLSearchParams({ ...keepBase, ...(type === 'changes' ? {} : { type }) }).toString()}`

  const header = (
    <div className="flex items-end justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-[-0.01em]">Activity</h1>
          <RoleBadge role="admin" />
        </div>
        <p className="text-[13px] text-muted-foreground">
          Secrets Manager events in {auth.account.name} from AWS CloudTrail (up to 90 days).
          Includes changes made outside this app.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <ActivityRange />
        <Button asChild variant="outline" size="sm" className="h-8">
          <Link href={newestHref}>
            <RotateCcwIcon />
            Newest
          </Link>
        </Button>
      </div>
    </div>
  )
  if (!result.ok) {
    return (
      <>
        {header}
        <AwsErrorState code={result.code} />
      </>
    )
  }

  const fetched = result.data.events
  const events = fetched.filter((e) => matchesType(e, type))
  const count = (t: ActivityType) => fetched.filter((e) => matchesType(e, t)).length
  const people = new Set(fetched.filter((e) => e.kind === 'reveal').map((e) => e.who)).size
  const keep = Object.fromEntries(
    Object.entries(raw).flatMap(([k, v]) =>
      one(v) && k !== 'cursor' && k !== 'end' ? [[k, one(v)!]] : [],
    ),
  )
  const olderHref = result.data.nextToken
    ? `?${new URLSearchParams({ ...keep, cursor: result.data.nextToken, end: String(end) }).toString()}`
    : null
  const emptyText = result.data.nextToken
    ? 'Nothing matches in the loaded events. Load older events to search further back.'
    : 'No matching events. CloudTrail can take up to 15 minutes to show new events.'
  const tiles: Record<ActivityType, { sub: string; icon?: React.ReactNode }> = {
    changes: { sub: cursor ? 'Older page' : 'Default view' },
    reveals: {
      sub: `by ${people} ${people === 1 ? 'person' : 'people'}`,
      icon: tileIcon(
        'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
        <EyeIcon className="size-4" />,
      ),
    },
    writes: {
      sub: 'create, update, tags, delete, restore',
      icon: tileIcon(
        'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
        <PencilLineIcon className="size-4" />,
      ),
    },
    failed: {
      sub: 'rejected by AWS',
      icon: tileIcon(
        'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
        <AlertTriangleIcon className="size-4" />,
      ),
    },
    all: {
      sub: 'including list / describe',
      icon: tileIcon('bg-muted text-foreground/80', <ActivityIcon className="size-4" />),
    },
  }

  return (
    <>
      {header}
      {/* CloudTrail is paged, so counts only cover what's loaded; "+" marks that more exist. */}
      <p className="-mb-2 text-xs text-muted-foreground">
        Counts cover the {fetched.length} {fetched.length === 1 ? 'event' : 'events'} loaded
        {cursor ? ' on this page' : ''} from {range.label.toLowerCase()}
        {result.data.nextToken ? '; older events are not counted yet.' : '.'}
      </p>
      <div role="group" aria-label="Show" className="grid grid-cols-5 gap-3">
        {ACTIVITY_TYPES.map((t) => (
          <FilterTile
            key={t.id}
            href={typeHref(t.id)}
            on={type === t.id}
            label={t.label}
            value={`${count(t.id)}${result.data.nextToken ? '+' : ''}`}
            sub={tiles[t.id].sub}
            icon={tiles[t.id].icon}
          />
        ))}
      </div>
      <ActivityView
        accountId={auth.account.id}
        events={events}
        loaded={fetched.length}
        now={now}
        emptyText={emptyText}
        olderLink={
          olderHref ? (
            <Button asChild variant="outline" size="sm" className="h-[30px]">
              <Link href={olderHref}>Load older events</Link>
            </Button>
          ) : null
        }
      />
    </>
  )
}
