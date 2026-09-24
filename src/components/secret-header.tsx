import { ChevronLeftIcon, ClockIcon, LayersIcon, ShieldCheckIcon } from 'lucide-react'
import Link from 'next/link'
import type { SecretMeta } from '@/lib/aws/secrets'
import {
  absoluteDate,
  isRecent,
  relativeTime,
  secretHref,
  shortVersion,
  requestTime,
} from '@/lib/ui/format'
import { cn } from '@/lib/utils'
import { CopyButton } from './copy-button'

export type Tab = 'value' | 'versions' | 'tags' | 'danger'

function MetaTile({
  icon,
  tint,
  label,
  children,
  sub,
}: {
  icon: React.ReactNode
  tint: string
  label: string
  children: React.ReactNode
  sub: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3.5 px-5 py-4">
      <span
        className={cn(
          'inline-flex size-9 shrink-0 items-center justify-center rounded-[9px]',
          tint,
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[11px] font-semibold tracking-[.06em] text-muted-foreground uppercase">
          {label}
        </span>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </div>
    </div>
  )
}

/** AWS returns no KmsKeyId for the default AWS managed key. */
function encryption(kmsKeyId?: string) {
  if (!kmsKeyId || kmsKeyId === 'alias/aws/secretsmanager') {
    return { label: 'AWS managed key', badge: 'default', detail: 'aws/secretsmanager' }
  }
  const detail = kmsKeyId.includes(':') ? kmsKeyId.split(':').slice(-1)[0] : kmsKeyId
  return { label: 'Customer managed key', badge: 'cmk', detail }
}

export function SecretHeader({
  accountId,
  meta,
  versionCount,
  tab,
  showDanger,
}: {
  accountId: string
  meta: SecretMeta
  versionCount: number
  tab: Tab
  showDanger: boolean
}) {
  const enc = encryption(meta.kmsKeyId)
  const now = requestTime()
  const tabs: [Tab, string][] = [
    ['value', 'Value'],
    ['versions', 'Versions'],
    ['tags', 'Tags'],
    ...(showDanger ? ([['danger', 'Danger zone']] as [Tab, string][]) : []),
  ]
  const divider = <span className="my-3 w-px self-stretch bg-border" />

  return (
    <>
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px]">
        <Link
          href={`/a/${encodeURIComponent(accountId)}`}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-3.5" />
          Secrets
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-mono">{meta.name}</span>
      </nav>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-mono text-2xl font-semibold break-all">{meta.name}</h1>
        {meta.description && <p className="text-sm text-muted-foreground">{meta.description}</p>}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)_1px_minmax(0,1fr)] rounded-xl border bg-card">
        <MetaTile
          icon={<LayersIcon className="size-[18px]" />}
          tint="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
          label="Current version"
          sub={
            <>
              {versionCount} {versionCount === 1 ? 'version' : 'versions'} retained ·{' '}
              <Link
                href={secretHref(accountId, meta.name, 'versions')}
                className="font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                View history
              </Link>
            </>
          }
        >
          <span className="font-mono text-base font-semibold" title={meta.currentVersionId}>
            {shortVersion(meta.currentVersionId)}
          </span>
          <span className="inline-flex h-5 items-center rounded-[5px] bg-green-100 px-1.5 font-mono text-[11px] font-semibold text-green-800 dark:bg-green-950 dark:text-green-300">
            AWSCURRENT
          </span>
          {meta.currentVersionId && (
            <CopyButton text={meta.currentVersionId} label="Copy version id" />
          )}
        </MetaTile>
        {divider}
        <MetaTile
          icon={<ClockIcon className="size-[18px]" />}
          tint="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
          label="Last changed"
          sub={
            <>
              {absoluteDate(meta.lastChangedDate, true)} UTC
              {meta.lastAccessedDate && (
                <> · last read {relativeTime(meta.lastAccessedDate, now)}</>
              )}
            </>
          }
        >
          <span className="text-base font-semibold">{relativeTime(meta.lastChangedDate, now)}</span>
          {isRecent(meta.lastChangedDate, now) && (
            <span className="inline-flex h-5 items-center rounded-full bg-blue-100 px-2 text-[11px] font-semibold tracking-wide text-blue-800 uppercase dark:bg-blue-950 dark:text-blue-300">
              recent
            </span>
          )}
        </MetaTile>
        {divider}
        <MetaTile
          icon={<ShieldCheckIcon className="size-[18px]" />}
          tint="bg-muted text-foreground/80"
          label="Encryption"
          sub={<span className="font-mono">{enc.detail}</span>}
        >
          <span className="text-base font-semibold">{enc.label}</span>
          <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[11px] font-semibold tracking-wide uppercase">
            {enc.badge}
          </span>
        </MetaTile>
      </div>
      <nav aria-label="Secret sections" className="flex border-b">
        {tabs.map(([id, label]) => (
          <Link
            key={id}
            href={secretHref(accountId, meta.name, id)}
            aria-current={tab === id ? 'page' : undefined}
            className={cn(
              'mr-6 inline-flex h-10 items-center border-b-2 px-1 text-sm font-medium',
              tab === id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </>
  )
}
