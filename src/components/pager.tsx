'use client'

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
    <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3 text-[13px]">
      <span className="text-muted-foreground">
        Showing <strong className="text-foreground">{shown}</strong>{' '}
        {shown === 1 ? 'secret' : 'secrets'}
        {nextToken ? ' on this page' : ''}
      </span>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">Rows per page</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {size}
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {PAGE_SIZES.map((s) => (
              <DropdownMenuItem key={s} asChild>
                <Link href={href({ size: String(s), cursor: null })}>{s}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="h-5 w-px bg-border" />
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
