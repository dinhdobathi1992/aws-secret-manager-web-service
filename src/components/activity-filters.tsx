'use client'

import { ChevronDownIcon, ClockIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ACTIVITY_RANGES, ACTIVITY_TYPES, parseActivityType } from '@/lib/ui/activity-options'

/** Type chips and range picker. Both change what is fetched from CloudTrail, so they are links. */
export function ActivityFilters({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const type = parseActivityType(params.get('type') ?? undefined)
  const range = params.get('range') ?? '7d'

  const href = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    // A new query starts from the newest events again.
    next.delete('cursor')
    next.delete('end')
    const s = next.toString()
    return s ? `${pathname}?${s}` : pathname
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div role="group" aria-label="Event type" className="flex gap-1.5">
        {ACTIVITY_TYPES.map((t) => (
          <Button
            key={t.id}
            asChild
            size="sm"
            variant={type === t.id ? 'default' : 'outline'}
            className="rounded-full"
          >
            <Link
              href={href({ type: t.id === 'changes' ? null : t.id })}
              aria-current={type === t.id ? 'true' : undefined}
            >
              {t.label}
            </Link>
          </Button>
        ))}
      </div>
      <span className="flex-1" />
      {children}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <ClockIcon />
            {ACTIVITY_RANGES.find((r) => r.id === range)?.label ?? 'Last 7 days'}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {ACTIVITY_RANGES.map((r) => (
            <DropdownMenuItem key={r.id} asChild>
              <Link href={href({ range: r.id === '7d' ? null : r.id })}>{r.label}</Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
