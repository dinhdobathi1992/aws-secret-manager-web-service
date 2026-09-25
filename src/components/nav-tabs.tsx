'use client'

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
      'flex h-[38px] shrink-0 items-center gap-2 rounded-md px-3.5 text-sm font-medium whitespace-nowrap text-primary transition-colors',
      on ? 'bg-primary-subtle' : 'hover:bg-primary-subtle/60',
    )
  return (
    <nav
      aria-label="Main"
      className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 md:order-none md:mx-0 md:w-auto md:overflow-visible md:px-0"
    >
      <Link
        href={base}
        className={item(active === 'secrets')}
        aria-current={active === 'secrets' ? 'page' : undefined}
      >
        Secrets
      </Link>
      {showActivity && (
        <Link
          href={`${base}/activity`}
          className={item(active === 'activity')}
          aria-current={active === 'activity' ? 'page' : undefined}
        >
          Activity
        </Link>
      )}
      <Link
        href={`${base}/deleted`}
        className={item(active === 'deleted')}
        aria-current={active === 'deleted' ? 'page' : undefined}
      >
        Scheduled deletion
        {deletedBadge}
      </Link>
    </nav>
  )
}
