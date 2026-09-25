import { KeyRoundIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { SecretSummary } from '@/lib/aws/secrets'
import {
  absoluteDate,
  freshness,
  FRESHNESS_LABEL,
  relativeTime,
  secretHref,
  splitName,
} from '@/lib/ui/format'
import { cn } from '@/lib/utils'
import { CopyButton } from './copy-button'
import { DOT, TagChip } from './secrets-table'
import { ViewSecretDialog } from './view-secret-dialog'

/** Cards layout of the secrets list (3 columns). Footers line up across a row. */
export function SecretCards({
  accountId,
  items,
  now,
  upn,
  canEdit,
}: {
  accountId: string
  items: SecretSummary[]
  now: number
  upn: string
  canEdit: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => {
        const { path, leaf } = splitName(s.name)
        const href = secretHref(accountId, s.name)
        const f = freshness(s.lastChangedDate, now)
        const tags = Object.entries(s.tags)
        return (
          <article key={s.name} className="surface flex flex-col gap-3.5 px-6 py-[22px]">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-subtle text-primary"
              >
                <KeyRoundIcon className="size-5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h3 className="text-[17px] leading-6 font-semibold break-words">
                  <Link href={href} className="text-foreground hover:underline">
                    <span className="font-medium text-muted-foreground">{path}</span>
                    {leaf}
                  </Link>
                </h3>
                {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
              </div>
              <CopyButton text={s.name} label={`Copy name ${s.name}`} />
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map(([k, v]) => (
                  <TagChip key={k} k={k} v={v} />
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span
                role="img"
                title={FRESHNESS_LABEL[f]}
                aria-label={FRESHNESS_LABEL[f]}
                className={cn('size-2 shrink-0 rounded-full', DOT[f])}
              />
              <span>
                Updated{' '}
                <strong className="font-semibold text-label">
                  {relativeTime(s.lastChangedDate, now)}
                </strong>{' '}
                · {absoluteDate(s.lastChangedDate)}
              </span>
            </div>
            <div className="mt-auto flex items-center gap-2.5 border-t border-[#f1f2f5] pt-4 dark:border-border">
              <ViewSecretDialog
                accountId={accountId}
                name={s.name}
                upn={upn}
                detailHref={href}
                canEdit={canEdit}
              />
              <Button asChild variant="outline">
                <Link href={href}>Details</Link>
              </Button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
