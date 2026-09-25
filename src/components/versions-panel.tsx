'use client'

import { EyeIcon, GitCompareIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { getVersions, getVersionValue, revealSecret, rollbackSecret } from '@/lib/actions/secrets'
import type { SecretVersion } from '@/lib/aws/secrets'
import { absoluteDate, relativeTime, shortVersion } from '@/lib/ui/format'
import { keyDiff, type KeyDiff } from '@/lib/ui/key-diff'
import { diffEntries, toModel } from '@/lib/ui/secret-value'
import { cn } from '@/lib/utils'
import { RoleBadge } from './role-badge'
import { KeyDiffList } from './key-diff-list'
import { useAutoHide } from './use-auto-hide'

function Stage({ s }: { s: string }) {
  const current = s === 'AWSCURRENT'
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-[5px] px-1.5 font-mono text-[11px] font-semibold',
        current
          ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
          : 'bg-muted text-foreground/80',
      )}
    >
      {s}
    </span>
  )
}

export function VersionsPanel({
  accountId,
  name,
  versions,
  currentVersionId,
  canRollback,
}: {
  accountId: string
  name: string
  versions: SecretVersion[]
  currentVersionId?: string
  canRollback: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [compare, setCompare] = useState<{ versionId: string; diff: KeyDiff } | null>(null)
  const [shown, setShown] = useState<{ versionId: string; value: string } | null>(null)
  const [rollback, setRollback] = useState<{
    target: string
    expected?: string
    loading: boolean
  } | null>(null)

  // A revealed version value closes after 30s or when the page is hidden.
  const closeShown = useCallback(() => setShown(null), [])
  useAutoHide(!!shown, closeShown)

  const target = { accountId, name }

  const doCompare = (versionId: string) =>
    startTransition(async () => {
      const [a, b] = await Promise.all([
        getVersionValue({ ...target, versionId }),
        revealSecret(target),
      ])
      if (!a.ok || !b.ok)
        return void toast.error((!a.ok ? a : b.ok ? null : b)?.message ?? 'Compare failed')
      const before = diffEntries(toModel(a.data.value, a.data.kind))
      const after = diffEntries(toModel(b.data.value, b.data.kind))
      // Only key names are kept; the values go out of scope here.
      setCompare({ versionId, diff: keyDiff(before, after) })
    })

  const doView = (versionId: string) =>
    startTransition(async () => {
      const res = await getVersionValue({ ...target, versionId })
      if (!res.ok) return void toast.error(res.message)
      setShown({ versionId, value: res.data.value })
    })

  // Re-read the current version when the dialog opens, so the stale-state check uses fresh data.
  const openRollback = (versionId: string) => {
    setRollback({ target: versionId, loading: true })
    startTransition(async () => {
      const res = await getVersions(target)
      if (!res.ok) {
        setRollback((prev) => (prev?.target === versionId ? null : prev))
        return void toast.error(res.message)
      }
      // Ignore a late result if the dialog was closed (or reopened for another version) meanwhile.
      setRollback((prev) =>
        prev?.target === versionId && prev.loading
          ? { target: versionId, expected: res.data.currentVersionId, loading: false }
          : prev,
      )
    })
  }

  const doRollback = () =>
    startTransition(async () => {
      if (!rollback?.expected) return
      const res = await rollbackSecret({
        ...target,
        targetVersionId: rollback.target,
        expectedCurrentVersionId: rollback.expected,
      })
      setRollback(null)
      if (!res.ok) {
        if (res.code === 'Conflict') {
          toast.error(
            'The current version changed since you opened this. Nothing was rolled back.',
            {
              action: { label: 'Reload', onClick: () => router.refresh() },
            },
          )
        } else toast.error(res.message)
        return
      }
      setCompare(null)
      toast.success(`Version ${shortVersion(rollback.target)} is now current.`)
      router.refresh()
    })

  const th =
    'h-11 px-6 text-left text-xs font-semibold tracking-[.04em] text-muted-foreground uppercase'
  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Versions" className="surface overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b bg-sunken">
            <tr>
              <th className={cn(th, 'w-[260px]')}>Version</th>
              <th className={cn(th, 'w-[260px]')}>Stages</th>
              <th className={th}>Created</th>
              <th className={cn(th, 'text-right')}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => {
              const isCurrent = v.versionId === currentVersionId
              return (
                <tr
                  key={v.versionId}
                  className="h-16 border-t border-[#f1f2f5] first:border-t-0 hover:bg-sunken dark:border-border"
                >
                  <td className="px-6 font-mono font-semibold text-foreground" title={v.versionId}>
                    {shortVersion(v.versionId)}
                  </td>
                  <td className="px-6">
                    <div className="flex gap-1.5">
                      {v.stages.length ? (
                        v.stages.map((s) => <Stage key={s} s={s} />)
                      ) : (
                        <span className="text-[13px] text-muted-foreground">deprecated</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {relativeTime(v.createdDate)}
                      </span>
                      <span className="text-[13px] text-muted-foreground">
                        {absoluteDate(v.createdDate, true)} UTC
                      </span>
                    </div>
                  </td>
                  <td className="px-6">
                    <div className="flex justify-end gap-2">
                      {!isCurrent && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => doCompare(v.versionId)}
                        >
                          <GitCompareIcon />
                          Compare keys
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => doView(v.versionId)}
                      >
                        <EyeIcon />
                        View
                      </Button>
                      {canRollback && !isCurrent && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => openRollback(v.versionId)}
                        >
                          Make current
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {versions.length === 1 && (
          <div className="flex items-center gap-2.5 border-t bg-sunken px-6 py-4 text-sm text-muted-foreground">
            <InfoIcon className="size-4 shrink-0" />
            <span>
              This is the only version. After the next save, the previous version appears here with{' '}
              <strong className="font-medium text-label">Compare keys</strong> and{' '}
              <strong className="font-medium text-label">Make current</strong> (admin).
            </span>
          </div>
        )}
      </section>

      {compare && (
        <div className="surface flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              Compare <span className="font-mono">{shortVersion(compare.versionId)}</span> → current
            </span>
            <span className="text-xs text-muted-foreground">
              Key names only · both reads were audited
            </span>
          </div>
          <KeyDiffList diff={compare.diff} showSame />
        </div>
      )}

      <Dialog open={!!shown} onOpenChange={(o) => !o && setShown(null)}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>
              Version <span className="font-mono">{shortVersion(shown?.versionId)}</span>
            </DialogTitle>
            <DialogDescription>
              This view was recorded in CloudTrail. The dialog closes after 30 seconds or when you
              leave the tab.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Version value"
            readOnly
            value={shown?.value ?? ''}
            className="min-h-48 border-0 bg-code-bg font-mono text-[13px] text-code-fg"
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!rollback} onOpenChange={(o) => !o && setRollback(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              Make version current? <RoleBadge role="admin" />
            </AlertDialogTitle>
            <AlertDialogDescription>
              {rollback?.loading ? (
                'Checking the current version…'
              ) : (
                <>
                  Moves <span className="font-mono">AWSCURRENT</span> from{' '}
                  <span className="font-mono">{shortVersion(rollback?.expected)}</span> to{' '}
                  <span className="font-mono">{shortVersion(rollback?.target)}</span>. Apps reading
                  the secret get this value on their next fetch.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 p-3 text-[13px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            If the current version changes before you confirm, this is cancelled and you’ll be asked
            to reload.
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={doRollback}
              disabled={pending || rollback?.loading || !rollback?.expected}
            >
              Make current
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
