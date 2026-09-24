import { ChevronLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { AwsErrorState } from '@/components/aws-error-state'
import { RestoreButton } from '@/components/restore-button'
import { can } from '@/lib/auth/rbac'
import { listDeleted, RECOVERY_WINDOW_DAYS } from '@/lib/aws/secrets'
import { load, pageContext } from '@/lib/data/page-data'
import { absoluteDate, deletionEstimate, requestTime } from '@/lib/ui/format'

export const dynamic = 'force-dynamic'

export default async function DeletedPage({ params }: { params: Promise<{ account: string }> }) {
  const { account } = await params
  const { auth, client } = await pageContext(account, 'list')
  const result = await load(() => listDeleted(client))
  const canRestore = can(auth.role, 'restore')
  const now = requestTime()
  const th =
    'h-10 px-4 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase'

  return (
    <>
      <Link
        href={`/a/${encodeURIComponent(auth.account.id)}`}
        className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-3.5" />
        Secrets
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Scheduled deletion</h1>
        <p className="text-sm text-muted-foreground">
          Secrets in {auth.account.name} that will be permanently deleted after their{' '}
          {RECOVERY_WINDOW_DAYS}-day recovery window.{canRestore ? ' Admins can restore them.' : ''}
        </p>
      </div>
      {!result.ok ? (
        <AwsErrorState code={result.code} />
      ) : result.data.items.length === 0 ? (
        <div className="rounded-xl border bg-card px-5 py-14 text-center text-sm text-muted-foreground">
          Nothing is scheduled for deletion.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full border-collapse">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className={`${th} pl-5`}>Name</th>
                <th className={th}>Description</th>
                <th className={th}>Requested</th>
                <th className={th}>Deletes on (about)</th>
                <th className={th}>Remaining</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.data.items.map((s) => {
                const est = deletionEstimate(s.deletedDate, RECOVERY_WINDOW_DAYS, now)
                return (
                  <tr key={s.name} className="border-b border-border/60 last:border-0">
                    <td className="py-3 pr-4 pl-5 font-mono text-sm font-medium">{s.name}</td>
                    <td className="px-4 text-sm text-muted-foreground">{s.description}</td>
                    <td className="px-4 text-sm text-muted-foreground">
                      {absoluteDate(s.deletedDate)}
                    </td>
                    <td className="px-4 text-sm">{est ? absoluteDate(est.deletesAt) : '—'}</td>
                    <td className="px-4">
                      {est && (
                        <span className="inline-flex h-5 items-center rounded-full bg-red-100 px-2 text-[11px] font-semibold text-red-800 dark:bg-red-950 dark:text-red-300">
                          {est.daysLeft} {est.daysLeft === 1 ? 'day' : 'days'} left
                        </span>
                      )}
                    </td>
                    <td className="pr-4 text-right">
                      {canRestore && <RestoreButton accountId={auth.account.id} name={s.name} />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
