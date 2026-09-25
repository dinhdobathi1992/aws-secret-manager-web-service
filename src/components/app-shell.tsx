import { KeyRoundIcon, LayersIcon } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import type { AccountOption } from '@/lib/data/page-data'
import { NavTabs } from './nav-tabs'
import { RoleBadge } from './role-badge'
import { ThemeToggle } from './theme-toggle'

export function AppShell({
  appName,
  logoUrl,
  current,
  user,
  deletedCount,
  showActivity,
  children,
}: {
  appName: string
  logoUrl?: string
  /** The account in the URL. Switching accounts happens on the Secrets page picker. */
  current: AccountOption
  user: { name: string; upn: string }
  deletedCount: Promise<number | null>
  /** Admins of the current account only. */
  showActivity: boolean
  children: React.ReactNode
}) {
  const base = `/a/${encodeURIComponent(current.id)}`
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col gap-8 px-5 pt-5 pb-12">
      <header className="surface sticky top-3 z-40 flex h-16 items-center gap-2 pr-3 pl-4">
        <Link
          href={base}
          className="mr-3 flex items-center gap-2.5 text-[17px] font-semibold text-foreground"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- runtime-configured URL, not a build asset
            <img src={logoUrl} alt="" className="size-9 rounded-lg object-contain" />
          ) : (
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary-subtle text-primary">
              <KeyRoundIcon className="size-5" />
            </span>
          )}
          {appName}
        </Link>
        <NavTabs
          base={base}
          showActivity={showActivity}
          deletedBadge={
            <Suspense fallback={null}>
              <DeletedCount count={deletedCount} />
            </Suspense>
          }
        />
        <div className="flex-1" />
        <span
          className="flex h-8 items-center gap-2 rounded-lg border bg-sunken px-2.5 text-[13px] text-label"
          title="Current AWS account"
        >
          <LayersIcon className="size-3.5 text-muted-foreground" />
          <span className="max-w-40 truncate">{current.name}</span>
          <RoleBadge role={current.role} />
        </span>
        <ThemeToggle />
        <span
          className="flex h-[38px] items-center gap-2.5 rounded-full border bg-sunken pr-3.5 pl-2 text-sm font-medium text-muted-foreground"
          title={user.upn}
        >
          <span className="inline-flex size-[26px] items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initial(user.name)}
          </span>
          <span className="max-w-36 truncate">{user.name}</span>
        </span>
        {/* POST, same-origin only (see /api/auth/logout). */}
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="flex h-[38px] items-center rounded-md px-3.5 text-sm font-medium text-primary hover:bg-primary-subtle"
          >
            Logout
          </button>
        </form>
      </header>
      <main className="flex flex-1 flex-col gap-6">{children}</main>
    </div>
  )
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

async function DeletedCount({ count }: { count: Promise<number | null> }) {
  const n = await count
  if (n === null) return null
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground">
      {n}
    </span>
  )
}
