import {
  ChevronLeftIcon,
  EyeIcon,
  LayersIcon,
  ClockIcon,
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
}: {
  icon: React.ReactNode
  tint: string
  label: string
  children: React.ReactNode
  sub: React.ReactNode
}) {
  return (
    <div className="surface flex min-w-0 gap-3.5 px-5 py-[18px]">
      <span
        className={cn(
          'inline-flex size-[38px] shrink-0 items-center justify-center rounded-[10px]',
          tint,
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-semibold tracking-[.04em] text-muted-foreground uppercase">
          {label}
        </span>
        <div className="flex min-h-6 items-center gap-2 text-base font-semibold text-foreground">
          {children}
        </div>
        <div className="line-clamp-2 text-[13px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  )
}

/** AWS returns no KmsKeyId for the default AWS managed key. */
function encryption(kmsKeyId?: string) {
  if (!kmsKeyId || kmsKeyId === 'alias/aws/secretsmanager') {
    return { label: 'AWS managed key', detail: 'aws/secretsmanager' }
  }
  const detail = kmsKeyId.includes(':') ? kmsKeyId.split(':').slice(-1)[0] : kmsKeyId
  return { label: 'Customer managed key', detail }
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
  // A later LastChangedDate means a metadata change, delete/restore or tag edit after the value.
  const laterChange =
    valueChangedAt &&
    meta.lastChangedDate &&
    Date.parse(meta.lastChangedDate) - Date.parse(valueChangedAt) > 60_000
      ? meta.lastChangedDate
      : undefined
  const count = (n: number) => (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground">
      {n}
    </span>
  )
  const tabClass = (on: boolean, danger = false) =>
    cn(
      '-mb-px inline-flex h-11 shrink-0 items-center gap-1.5 border-b-2 text-[15px] font-medium whitespace-nowrap',
      danger
        ? on
          ? 'border-destructive text-destructive'
          : 'border-transparent text-destructive hover:border-destructive/40'
        : on
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground',
    )

  return (
    <div className="flex flex-col">
      <nav aria-label="Breadcrumb" className="flex h-5 items-center text-sm">
        <Link
          href={`/a/${encodeURIComponent(accountId)}`}
          className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary-hover"
        >
          <ChevronLeftIcon className="size-4" />
          Back to secrets
        </Link>
      </nav>
      <div className="mt-3.5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-mono text-[26px] leading-[34px] font-semibold break-all text-foreground">
            {meta.name}
          </h1>
          {meta.description && (
            <p className="text-[15px] text-muted-foreground">{meta.description}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <CopyButton text={meta.name} label="Copy secret name">
            Copy name
          </CopyButton>
          <CopyButton text={meta.arn} label="Copy secret ARN">
            Copy ARN
          </CopyButton>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetaTile
          icon={<LayersIcon className="size-[18px]" />}
          tint="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
          label="Current version"
          sub={
            <>
              {versionCount} {versionCount === 1 ? 'version' : 'versions'} retained ·{' '}
              <Link
                href={secretHref(accountId, meta.name, 'versions')}
                className="font-medium text-primary hover:text-primary-hover"
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
        </MetaTile>
        <MetaTile
          icon={<ClockIcon className="size-[18px]" />}
          tint="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
          label="Value changed"
          sub={
            laterChange
              ? `${absoluteDate(changed, true)} UTC · metadata changed ${relativeTime(laterChange, now)}`
              : `${absoluteDate(changed, true)} UTC`
          }
        >
          <span>{relativeTime(changed, now)}</span>
          {isRecent(changed, now) && <BadgeTag tone="blue">recent</BadgeTag>}
        </MetaTile>
        <MetaTile
          icon={<EyeIcon className="size-[18px]" />}
          tint="bg-muted text-label"
          label="Last accessed"
          sub="AWS records access by day"
        >
          <span>{meta.lastAccessedDate ? absoluteDate(meta.lastAccessedDate) : 'Never'}</span>
        </MetaTile>
        <MetaTile
          icon={<ShieldCheckIcon className="size-[18px]" />}
          tint="bg-muted text-label"
          label="Encryption"
          sub={<span className="font-mono text-xs">{enc.detail}</span>}
        >
          <span className="truncate">{enc.label}</span>
        </MetaTile>
      </div>

      <nav
        aria-label="Secret sections"
        className="mt-7 flex h-[45px] items-end gap-5 overflow-x-auto overflow-y-hidden border-b md:gap-7"
      >
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
