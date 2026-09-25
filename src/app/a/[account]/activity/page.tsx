import {
  ActivityIcon,
  AlertTriangleIcon,
  EyeIcon,
  PencilLineIcon,
  RotateCcwIcon,
} from 'lucide-react'
import Link from 'next/link'
import { ActivityRange } from '@/components/activity-range'
import { ActivityTiles } from '@/components/activity-tiles'
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

const tileIcon = (tint: string, icon: React.ReactNode) => (
  <span className={cn('inline-flex size-[30px] items-center justify-center rounded-lg', tint)}>
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
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-3xl font-semibold text-foreground">Activity</h1>
          <RoleBadge role="admin" />
        </div>
        <p className="text-[15px] text-muted-foreground">
          Secrets Manager events in {auth.account.name} from AWS CloudTrail (up to 90 days),
          including changes made outside this app.
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <ActivityRange />
        <Button asChild variant="secondary">
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
      <p className="-mb-3 text-[13px] text-muted-foreground">
        Counts cover the {fetched.length} {fetched.length === 1 ? 'event' : 'events'} loaded
        {cursor ? ' on this page' : ''} from {range.label.toLowerCase()}
        {result.data.nextToken ? '; older events are not counted yet.' : '.'}
      </p>
      <ActivityTiles
        tiles={ACTIVITY_TYPES.map((t) => ({
          id: t.id,
          label: t.label,
          href: typeHref(t.id),
          on: type === t.id,
          value: `${count(t.id)}${result.data.nextToken ? '+' : ''}`,
          sub: tiles[t.id].sub,
          icon: tiles[t.id].icon,
        }))}
      />
      <ActivityView
        accountId={auth.account.id}
        events={events}
        loaded={fetched.length}
        now={now}
        emptyText={emptyText}
        olderLink={
          olderHref ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={olderHref}>Load older events</Link>
            </Button>
          ) : null
        }
      />
    </>
  )
}
