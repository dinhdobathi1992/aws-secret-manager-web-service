import { AppShell } from '@/components/app-shell'
import { listDeleted } from '@/lib/aws/secrets'
import { can } from '@/lib/auth/rbac'
import { getConfig } from '@/lib/config'
import { accountOptions, pageContext } from '@/lib/data/page-data'

export const dynamic = 'force-dynamic'

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ account: string }>
}) {
  const { account } = await params
  const { auth, client } = await pageContext(account, 'list')
  const cfg = getConfig()
  // Streamed into the header; a failure just hides the count.
  const deletedCount = listDeleted(client)
    .then((r) => r.items.length)
    .catch(() => null)

  return (
    <AppShell
      appName={cfg.APP_NAME}
      logoUrl={cfg.APP_LOGO_URL}
      accounts={accountOptions(auth)}
      currentId={auth.account.id}
      user={{ name: auth.user.name, upn: auth.user.upn }}
      deletedCount={deletedCount}
      showActivity={can(auth.role, 'activity')}
    >
      {children}
    </AppShell>
  )
}
