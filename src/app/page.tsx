import { redirect } from 'next/navigation'
import { readSession } from '@/lib/auth/session'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

/** Sends the user to the first configured account they have a role in. */
export default async function Home() {
  const user = await readSession()
  if (!user) redirect('/login')
  const first = getConfig().ACCOUNTS.find((a) => user.roles[a.id])
  if (first) redirect(`/a/${encodeURIComponent(first.id)}`)
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="flex max-w-md flex-col gap-2 surface p-8">
        <h1 className="text-lg font-semibold">No access yet</h1>
        <p className="text-sm text-muted-foreground">
          You are signed in as {user.upn}, but you don’t have a role in any configured AWS account.
          Ask an admin to add you to the right Entra group, then sign in again.
        </p>
        <form action="/api/auth/logout" method="post" className="pt-2">
          <button type="submit" className="text-sm font-medium underline">
            Sign out
          </button>
        </form>
      </div>
    </main>
  )
}
