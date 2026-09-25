import {
  ChevronLeftIcon,
  EyeIcon,
  LayersIcon,
  PencilLineIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import Link from 'next/link'
import type { SecretMeta } from '@/lib/aws/secrets'
import { absoluteDate, isRecent, relativeTime, secretHref, shortVersion } from '@/lib/ui/format'
import { cn } from '@/lib/utils'
import { BadgeTag } from './badge-tag'
import { CopyButton } from './copy-button'

export type Tab = 'value' | 'versions' | 'tags' | 'danger'

function MetaTile({
  icon,
  tint,
  label,
  children,
  sub,
  first,
}: {
  icon: React.ReactNode
  tint: string
  label: string
  children: React.ReactNode
  sub: React.ReactNode
  first?: boolean
}) {
  return (
    <div className={cn('flex min-w-0 gap-3 px-5 py-4', !first && 'border-l')}>
      <span
        className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-lg', tint)}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[11px] font-semibold tracking-[.06em] text-muted-foreground uppercase">
          {label}
        </span>
        <div className="flex min-h-6 items-center gap-2 text-[15px] font-semibold">{children}</div>
        <div className="truncate text-xs text-muted-foreground">{sub}</div>
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
  valueChangedAt,
  tab,
  showDanger,
  now,
}: {
  accountId: string
  meta: SecretMeta
  versionCount: number
  /** Creation time of the AWSCURRENT version, i.e. when the value last changed. */
  valueChangedAt?: string
  tab: Tab
  showDanger: boolean
  now: number
}) {
  const enc = encryption(meta.kmsKeyId)
  const tagCount = Object.keys(meta.tags).length
  const changed = valueChangedAt ?? meta.lastChangedDate
  const count = (n: number) => (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-muted px-[5px] text-[11px] font-semibold text-muted-foreground">
      {n}
    </span>
  )
  const tabClass = (on: boolean, danger = false) =>
    cn(
      '-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 text-sm font-medium',
      danger
        ? on
          ? 'border-red-600 text-red-700 dark:border-red-400 dark:text-red-300'
          : 'border-transparent text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300'
        : on
          ? 'border-foreground text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
    )

  return (
    <div className="flex flex-col">
      <nav
        aria-label="Breadcrumb"
        className="flex h-5 items-center gap-1.5 text-[13px] text-muted-foreground"
      >
        <Link
          href={`/a/${encodeURIComponent(accountId)}`}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <ChevronLeftIcon className="size-3.5" />
          Secrets
        </Link>
        <span>/</span>
        <span className="font-mono text-foreground">{meta.name}</span>
      </nav>
      <div className="mt-3 flex items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-mono text-2xl leading-8 font-semibold tracking-[-0.01em] break-all">
            {meta.name}
          </h1>
          {meta.description && <p className="text-sm text-muted-foreground">{meta.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CopyButton text={meta.name} label="Copy secret name">
            Copy name
          </CopyButton>
          <CopyButton text={meta.arn} label="Copy secret ARN">
            Copy ARN
          </CopyButton>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 rounded-xl border bg-card">
        <MetaTile
          first
          icon={<LayersIcon className="size-4" />}
          tint="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
          label="Current version"
          sub={
            <>
              {versionCount} {versionCount === 1 ? 'version' : 'versions'} retained ·{' '}
              <Link
                href={secretHref(accountId, meta.name, 'versions')}
                className="text-blue-700 hover:underline dark:text-blue-300"
              >
                View history
              </Link>
            </>
          }
        >
          <span className="font-mono" title={meta.currentVersionId}>
            {shortVersion(meta.currentVersionId)}
          </span>
          <BadgeTag tone="green" mono>
            AWSCURRENT
          </BadgeTag>
          {meta.currentVersionId && (
            <CopyButton text={meta.currentVersionId} label="Copy version id" />
          )}
        </MetaTile>
        <MetaTile
          icon={<PencilLineIcon className="size-4" />}
          tint="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
          label="Value changed"
          sub={`${absoluteDate(changed, true)} UTC`}
        >
          <span>{relativeTime(changed, now)}</span>
          {isRecent(changed, now) && <BadgeTag tone="blue">recent</BadgeTag>}
        </MetaTile>
        <MetaTile
          icon={<EyeIcon className="size-4" />}
          tint="bg-muted text-foreground/80"
          label="Last accessed"
          sub="AWS records access by day, not time"
        >
          <span>{meta.lastAccessedDate ? absoluteDate(meta.lastAccessedDate) : 'Never'}</span>
        </MetaTile>
        <MetaTile
          icon={<ShieldCheckIcon className="size-4" />}
          tint="bg-muted text-foreground/80"
          label="Encryption"
          sub={<span className="font-mono">{enc.detail}</span>}
        >
          <span>{enc.label}</span>
          <BadgeTag>{enc.badge}</BadgeTag>
        </MetaTile>
      </div>

      <nav aria-label="Secret sections" className="mt-6 flex h-[41px] items-end gap-6 border-b">
        <Link
          href={secretHref(accountId, meta.name)}
          className={tabClass(tab === 'value')}
          aria-current={tab === 'value' ? 'page' : undefined}
        >
          Value
        </Link>
        <Link
          href={secretHref(accountId, meta.name, 'versions')}
          className={tabClass(tab === 'versions')}
          aria-current={tab === 'versions' ? 'page' : undefined}
        >
          Versions {count(versionCount)}
        </Link>
        <Link
          href={secretHref(accountId, meta.name, 'tags')}
          className={tabClass(tab === 'tags')}
          aria-current={tab === 'tags' ? 'page' : undefined}
        >
          Tags {count(tagCount)}
        </Link>
        <div className="flex-1" />
        {showDanger && (
          <Link
            href={secretHref(accountId, meta.name, 'danger')}
            className={tabClass(tab === 'danger', true)}
            aria-current={tab === 'danger' ? 'page' : undefined}
          >
            <TriangleAlertIcon className="size-[15px]" />
            Danger zone
            <BadgeTag tone="amber">admin</BadgeTag>
          </Link>
        )}
      </nav>
    </div>
  )
}
