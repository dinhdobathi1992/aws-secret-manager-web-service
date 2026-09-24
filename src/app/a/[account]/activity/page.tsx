import { ActivityIcon, AlertTriangleIcon, EyeIcon, PencilLineIcon } from 'lucide-react'
import Link from 'next/link'
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
  activityWindow,
  matchesType,
  parseActivityType,
} from '@/lib/ui/activity-options'
import { absoluteDate, requestTime } from '@/lib/ui/format'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type RawSearch = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function Tile({
  icon,
  tint,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  tint: string
  label: string
  value: number
  sub: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5">
      <span className={cn('inline-flex size-9 items-center justify-center rounded-[9px]', tint)}>
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold tracking-[.06em] text-muted-foreground uppercase">
          {label}
        </span>
        <span className="text-xl font-semibold">{value}</span>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </div>
    </div>
  )
}

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

  const header = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2.5">
        <h1 className="text-2xl font-semibold">Activity</h1>
        <RoleBadge role="admin" />
      </div>
      <p className="text-sm text-muted-foreground">
        Secrets Manager events in {auth.account.name}, from AWS CloudTrail (up to 90 days). Includes
        changes made outside this app.
      </p>
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
  const reveals = fetched.filter((e) => e.kind === 'reveal')
  const people = new Set(reveals.map((e) => e.who)).size
  const newest = fetched[0]?.time
  const oldest = fetched.at(-1)?.time
  // Tiles describe the loaded window, which may be shorter than the selected range.
  const scope = fetched.length
    ? `${fetched.length} events loaded, ${absoluteDate(oldest)} – ${absoluteDate(newest)}`
    : `none in ${range.label.toLowerCase()}`
  const keep = Object.fromEntries(
    Object.entries(raw).flatMap(([k, v]) =>
      one(v) && k !== 'cursor' && k !== 'end' ? [[k, one(v)!]] : [],
    ),
  )
  const olderHref = result.data.nextToken
    ? `?${new URLSearchParams({ ...keep, cursor: result.data.nextToken, end: String(end) }).toString()}`
    : null
  const newestHref = cursor ? `?${new URLSearchParams(keep).toString()}` : null
  const emptyText = result.data.nextToken
    ? 'Nothing matches in the loaded events. Load older events to search further back.'
    : 'No matching events. CloudTrail can take up to 15 minutes to show new events.'

  return (
    <>
      {header}
      <div className="grid grid-cols-4 gap-3">
        <Tile
          icon={<ActivityIcon className="size-[18px]" />}
          tint="bg-muted text-foreground/80"
          label="Events"
          value={fetched.length}
          sub={scope}
        />
        <Tile
          icon={<EyeIcon className="size-[18px]" />}
          tint="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
          label="Reveals"
          value={reveals.length}
          sub={`${people} ${people === 1 ? 'person' : 'people'}`}
        />
        <Tile
          icon={<PencilLineIcon className="size-[18px]" />}
          tint="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
          label="Changes"
          value={fetched.filter((e) => e.kind === 'change').length}
          sub="create, update, tags, delete, rollback"
        />
        <Tile
          icon={<AlertTriangleIcon className="size-[18px]" />}
          tint="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
          label="Failed"
          value={fetched.filter((e) => e.errorCode).length}
          sub="rejected by AWS"
        />
      </div>
      <ActivityView
        accountId={auth.account.id}
        events={events}
        now={now}
        emptyText={emptyText}
        footer={
          <div className="flex items-center justify-between gap-4 border-t bg-muted/30 px-5 py-3 text-[13px]">
            <span className="text-muted-foreground">
              Blocked attempts inside the app (for example a reader trying to delete) never reach
              AWS; they are in the app’s audit log, not here.
            </span>
            <div className="flex shrink-0 gap-2">
              {newestHref && (
                <Button asChild variant="outline" size="sm">
                  <Link href={newestHref}>Newest</Link>
                </Button>
              )}
              {olderHref && (
                <Button asChild variant="outline" size="sm">
                  <Link href={olderHref}>Load older events</Link>
                </Button>
              )}
            </div>
          </div>
        }
      />
    </>
  )
}
