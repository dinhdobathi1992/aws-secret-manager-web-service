import { KeyRoundIcon } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import type { AccountOption } from '@/lib/data/page-data'
import { AccountSwitcher } from './account-switcher'
import { NavTabs } from './nav-tabs'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './user-menu'

export function AppShell({
  appName,
  logoUrl,
  accounts,
  currentId,
  user,
  deletedCount,
  showActivity,
  children,
}: {
  appName: string
  logoUrl?: string
  accounts: AccountOption[]
  currentId: string
  user: { name: string; upn: string }
  deletedCount: Promise<number | null>
  /** Admins of the current account only. */
  showActivity: boolean
  children: React.ReactNode
}) {
  const base = `/a/${encodeURIComponent(currentId)}`
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-10">
        <Link href={base} className="flex items-center gap-2.5 text-sm font-semibold">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- runtime-configured URL, not a build asset
            <img src={logoUrl} alt="" className="size-7 rounded-[7px] object-contain" />
          ) : (
            <span className="inline-flex size-7 items-center justify-center rounded-[7px] bg-primary text-primary-foreground">
              <KeyRoundIcon className="size-[15px]" />
            </span>
          )}
          {appName}
        </Link>
        <span className="h-5 w-px bg-border" />
        <AccountSwitcher accounts={accounts} currentId={currentId} />
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
        <ThemeToggle />
        <UserMenu name={user.name} upn={user.upn} />
      </header>
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-10 py-8">
        {children}
      </main>
    </div>
  )
}

async function DeletedCount({ count }: { count: Promise<number | null> }) {
  const n = await count
  if (n === null) return null
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-muted px-[5px] text-[11px] font-semibold text-muted-foreground">
      {n}
    </span>
  )
}
