import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, ChevronsUpDownIcon } from 'lucide-react'
import Link from 'next/link'
import type { SecretSummary } from '@/lib/aws/secrets'
import {
  absoluteDate,
  freshness,
  FRESHNESS_LABEL,
  prefixColor,
  relativeTime,
  secretHref,
  splitName,
  tagColor,
  type Freshness,
} from '@/lib/ui/format'
import { cn } from '@/lib/utils'
import { CopyButton } from './copy-button'

export const DOT: Record<Freshness, string> = {
  week: 'bg-green-500',
  quarter: 'bg-amber-500',
  stale: 'bg-zinc-500',
}

export type SortKey = 'name' | 'changed'

export function TagChip({ k, v }: { k: string; v: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-[5px] rounded-md px-2 font-mono text-xs whitespace-nowrap',
        tagColor(k),
      )}
    >
      <span className="opacity-70">{k}</span>
      <span className="font-semibold">{v}</span>
    </span>
  )
}

export function NameCell({
  accountId,
  name,
  description,
}: {
  accountId: string
  name: string
  description?: string
}) {
  const { path, leaf, top } = splitName(name)
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-semibold',
          prefixColor(top),
        )}
      >
        {top.slice(0, 2)}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          href={secretHref(accountId, name)}
          className="truncate font-mono text-[13px] hover:underline"
        >
          <span className="text-muted-foreground">{path}</span>
          <span className="font-semibold">{leaf}</span>
        </Link>
        {description && (
          <span className="truncate text-xs text-muted-foreground">{description}</span>
        )}
      </div>
    </div>
  )
}

function SortHeader({
  label,
  sortKey,
  sort,
  dir,
  hrefFor,
}: {
  label: string
  sortKey: SortKey
  sort: SortKey
  dir: 'asc' | 'desc'
  hrefFor: (s: SortKey, d: 'asc' | 'desc') => string
}) {
  const active = sort === sortKey
  const next = active && dir === 'asc' ? 'desc' : 'asc'
  const Icon = !active ? ChevronsUpDownIcon : dir === 'asc' ? ArrowUpIcon : ArrowDownIcon
  return (
    <Link
      href={hrefFor(sortKey, next)}
      aria-label={`Sort by ${label}`}
      className={cn('inline-flex items-center gap-1.5', active && 'text-foreground')}
    >
      {label}
      <Icon className="size-3" />
    </Link>
  )
}

export function SecretsTable({
  accountId,
  items,
  sort,
  dir,
  hrefFor,
  now,
}: {
  accountId: string
  items: SecretSummary[]
  sort: SortKey
  dir: 'asc' | 'desc'
  hrefFor: (s: SortKey, d: 'asc' | 'desc') => string
  now: number
}) {
  const th =
    'h-10 px-4 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase'
  return (
    <table className="w-full border-collapse">
      <thead className="border-b bg-muted/40">
        <tr>
          <th className={th}>
            <SortHeader label="Name" sortKey="name" sort={sort} dir={dir} hrefFor={hrefFor} />
          </th>
          <th className={cn(th, 'w-[420px]')}>Tags</th>
          <th className={cn(th, 'w-[200px]')}>
            <SortHeader
              label="Last changed"
              sortKey="changed"
              sort={sort}
              dir={dir}
              hrefFor={hrefFor}
            />
          </th>
          <th className={cn(th, 'w-20')}>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((s) => {
          const f = freshness(s.lastChangedDate, now)
          const tags = Object.entries(s.tags)
          return (
            <tr
              key={s.name}
              className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
            >
              <td className="py-3.5 pr-4 pl-5">
                <NameCell accountId={accountId} name={s.name} description={s.description} />
              </td>
              <td className="px-4">
                <div className="flex flex-wrap gap-1.5">
                  {tags.length ? (
                    tags.map(([k, v]) => <TagChip key={k} k={k} v={v} />)
                  ) : (
                    <span className="text-xs text-muted-foreground/70">No tags</span>
                  )}
                </div>
              </td>
              <td className="px-4">
                <div className="flex items-start gap-2">
                  <span
                    title={FRESHNESS_LABEL[f]}
                    aria-label={FRESHNESS_LABEL[f]}
                    className={cn('mt-1.5 size-2 shrink-0 rounded-full', DOT[f])}
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {relativeTime(s.lastChangedDate, now)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {absoluteDate(s.lastChangedDate)}
                    </span>
                  </div>
                </div>
              </td>
              <td className="pr-4">
                <div className="flex justify-end gap-0.5">
                  <CopyButton text={s.name} label={`Copy name ${s.name}`} />
                  <Link
                    href={secretHref(accountId, s.name)}
                    aria-label={`Open ${s.name}`}
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  >
                    <ChevronRightIcon className="size-4" />
                  </Link>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
