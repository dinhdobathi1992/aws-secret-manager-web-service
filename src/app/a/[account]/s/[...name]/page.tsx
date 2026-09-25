import { ClockIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AwsErrorState } from '@/components/aws-error-state'
import { DangerPanel } from '@/components/danger-panel'
import { ForbiddenState } from '@/components/forbidden-state'
import { SecretHeader, type Tab } from '@/components/secret-header'
import { TagsPanel } from '@/components/tags-panel'
import { ValuePanel } from '@/components/value-panel'
import { VersionsPanel } from '@/components/versions-panel'
import { can } from '@/lib/auth/rbac'
import { describeSecret, listVersions, RECOVERY_WINDOW_DAYS } from '@/lib/aws/secrets'
import { load, pageContext } from '@/lib/data/page-data'
import { absoluteDate, requestTime, secretNameFromSegments } from '@/lib/ui/format'

export const dynamic = 'force-dynamic'

const TABS: Tab[] = ['value', 'versions', 'tags', 'danger']

export default async function SecretPage({
  params,
  searchParams,
}: {
  params: Promise<{ account: string; name: string[] }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { account, name: segments } = await params
  const name = secretNameFromSegments(segments)
  if (!name) notFound()
  const requested = (await searchParams).tab
  const tab = TABS.find((t) => t === requested) ?? 'value'
  const { auth, client } = await pageContext(account, 'view')

  // Metadata only. Values are fetched by the reveal action, never rendered here.
  const result = await load(() =>
    Promise.all([describeSecret(client, name), listVersions(client, name)]),
  )
  if (!result.ok) return <AwsErrorState code={result.code} />
  const [meta, versions] = result.data
  const isAdmin = can(auth.role, 'delete')

  return (
    <>
      <SecretHeader
        accountId={auth.account.id}
        meta={meta}
        versionCount={versions.length}
        valueChangedAt={versions.find((v) => v.versionId === meta.currentVersionId)?.createdDate}
        tab={tab}
        showDanger={isAdmin}
        now={requestTime()}
      />
      {meta.deletedDate && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <ClockIcon className="size-4" />
          Deletion was requested on {absoluteDate(meta.deletedDate)}.
          <Link
            href={`/a/${encodeURIComponent(auth.account.id)}/deleted`}
            className="font-medium underline"
          >
            Restore from Scheduled deletion
          </Link>
        </div>
      )}
      {tab === 'value' && (
        <ValuePanel
          accountId={auth.account.id}
          name={name}
          canEdit={can(auth.role, 'update')}
          upn={auth.user.upn}
        />
      )}
      {tab === 'versions' && (
        <VersionsPanel
          accountId={auth.account.id}
          name={name}
          versions={versions}
          currentVersionId={meta.currentVersionId}
          canRollback={can(auth.role, 'rollback')}
        />
      )}
      {tab === 'tags' && (
        <TagsPanel
          key={JSON.stringify(meta.tags)}
          accountId={auth.account.id}
          name={name}
          tags={meta.tags}
          canEdit={can(auth.role, 'tag')}
        />
      )}
      {tab === 'danger' &&
        (isAdmin ? (
          <DangerPanel
            accountId={auth.account.id}
            name={name}
            lastAccessed={meta.lastAccessedDate ? absoluteDate(meta.lastAccessedDate) : undefined}
            recoveryDays={RECOVERY_WINDOW_DAYS}
            goneBy={absoluteDate(
              new Date(requestTime() + RECOVERY_WINDOW_DAYS * 86_400_000).toISOString(),
            )}
          />
        ) : (
          <ForbiddenState requiredRole="admin" currentRole={auth.role} />
        ))}
    </>
  )
}
