'use client'

import { ActivityIcon, ClockIcon, LockIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/** Main navigation. Secrets is active on the list and every secret page. */
export function NavTabs({
  base,
  showActivity,
  deletedBadge,
}: {
  base: string
  showActivity: boolean
  deletedBadge: React.ReactNode
}) {
  const pathname = usePathname()
  const active = pathname.startsWith(`${base}/activity`)
    ? 'activity'
    : pathname.startsWith(`${base}/deleted`)
      ? 'deleted'
      : 'secrets'
  const item = (on: boolean) =>
    cn(
      'flex h-8 items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium transition-colors',
      on ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
    )
  return (
    <nav aria-label="Main" className="ml-2 flex items-center gap-0.5">
      <Link
        href={base}
        className={item(active === 'secrets')}
        aria-current={active === 'secrets' ? 'page' : undefined}
      >
        <LockIcon className="size-[15px]" />
        Secrets
      </Link>
      {showActivity && (
        <Link
          href={`${base}/activity`}
          className={item(active === 'activity')}
          aria-current={active === 'activity' ? 'page' : undefined}
        >
          <ActivityIcon className="size-[15px]" />
          Activity
        </Link>
      )}
      <Link
        href={`${base}/deleted`}
        className={item(active === 'deleted')}
        aria-current={active === 'deleted' ? 'page' : undefined}
      >
        <ClockIcon className="size-[15px]" />
        Scheduled deletion
        {deletedBadge}
      </Link>
    </nav>
  )
}
