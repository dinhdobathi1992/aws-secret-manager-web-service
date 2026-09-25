'use client'

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PAGE_SIZES } from '@/lib/ui/format'

/**
 * Cursor pagination (AWS NextToken). "Previous" walks browser history, since AWS tokens only go
 * forward.
 */
export function Pager({
  shown,
  size,
  nextToken,
}: {
  shown: number
  size: number
  nextToken?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const hasPrev = params.has('cursor')
  const href = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    return `${pathname}?${next.toString()}`
  }

  return (
    <div className="flex items-center justify-between px-5 py-3 text-[13px] text-muted-foreground">
      <span>
        Showing <strong className="text-foreground">{shown}</strong>{' '}
        {shown === 1 ? 'secret' : 'secrets'}
        {nextToken ? ' on this page' : ''}
      </span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2">
          Rows per page
          <select
            value={size}
            onChange={(e) => router.push(href({ size: e.target.value, cursor: null }))}
            className="h-[34px] rounded-lg border bg-card px-2 text-[13px] text-foreground"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button variant="outline" size="sm" disabled={!hasPrev} onClick={() => router.back()}>
          <ChevronLeftIcon />
          Previous
        </Button>
        {nextToken ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={href({ cursor: nextToken })}>
              Next
              <ChevronRightIcon />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRightIcon />
          </Button>
        )}
      </div>
    </div>
  )
}
