import { ClockIcon, KeyRoundIcon } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import type { AccountOption } from '@/lib/data/page-data'
import { AccountSwitcher } from './account-switcher'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './user-menu'

export function AppShell({
  appName,
  logoUrl,
  accounts,
  currentId,
  user,
  deletedCount,
  children,
}: {
  appName: string
  logoUrl?: string
  accounts: AccountOption[]
  currentId: string
  user: { name: string; upn: string }
  deletedCount: Promise<number | null>
  children: React.ReactNode
}) {
  const base = `/a/${encodeURIComponent(currentId)}`
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-card px-6">
        <Link href={base} className="flex items-center gap-2.5 text-[15px] font-semibold">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- runtime-configured URL, not a build asset
            <img src={logoUrl} alt="" className="size-7 rounded-md object-contain" />
          ) : (
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <KeyRoundIcon className="size-4" />
            </span>
          )}
          {appName}
        </Link>
        <span className="h-6 w-px bg-border" />
        <AccountSwitcher accounts={accounts} currentId={currentId} />
        <div className="flex-1" />
        <Button variant="ghost" asChild className="h-9 gap-2">
          <Link href={`${base}/deleted`}>
            <ClockIcon />
            Scheduled deletion
            <Suspense fallback={null}>
              <DeletedCount count={deletedCount} />
            </Suspense>
          </Link>
        </Button>
        <ThemeToggle />
        <UserMenu name={user.name} upn={user.upn} />
      </header>
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-10 py-8">
        {children}
      </main>
    </div>
  )
}

async function DeletedCount({ count }: { count: Promise<number | null> }) {
  const n = await count
  if (!n) return null
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-semibold">
      {n}
    </span>
  )
}
