'use client'

import { ClockIcon, EyeIcon, EyeOffIcon, LockIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState, useTransition } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { revealSecret, updateSecretValue } from '@/lib/actions/secrets'
import { hasChanges, keyDiff, type KeyDiff } from '@/lib/ui/key-diff'
import {
  diffEntries,
  isValidJson,
  serialize,
  toModel,
  type ValueModel,
} from '@/lib/ui/secret-value'
import { cn } from '@/lib/utils'
import { KeyDiffList } from './key-diff-list'
import { entriesFrom, rowsFrom, type KvRow } from '@/lib/ui/editor-model'
import { KvEditor } from './kv-editor'
import { useAutoHide } from './use-auto-hide'

const CLIPBOARD_CLEAR_MS = 30_000

type Revealed = { versionId?: string; original: ValueModel }

/** Best-effort: overwrite the clipboard later. Depends on browser permission; not a control. */
export async function copyWithClear(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success('Copied. The clipboard is cleared in 30s where the browser allows it.')
    setTimeout(() => {
      navigator.clipboard.writeText('').catch(() => {})
    }, CLIPBOARD_CLEAR_MS)
  } catch {
    toast.error('Clipboard access was blocked by the browser.')
  }
}

/**
 * The value tab. Nothing is fetched until Reveal (an audited server action). Values stay in
 * component state only, and are dropped after 30s or when the tab is hidden, unless there are
 * unsaved edits.
 */
export function ValuePanel({
  accountId,
  name,
  canEdit,
}: {
  accountId: string
  name: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [revealed, setRevealed] = useState<Revealed | null>(null)
  const [rows, setRows] = useState<KvRow[]>([])
  const [raw, setRaw] = useState('')
  const [mode, setMode] = useState<'kv' | 'raw'>('kv')
  const [confirm, setConfirm] = useState<{ diff: KeyDiff; value: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Set only by a real user edit, so re-serialisation quirks never pause auto-mask.
  const [edited, setEdited] = useState(false)
  const [pending, startTransition] = useTransition()

  const hide = useCallback(() => {
    setEdited(false)
    setRevealed(null)
    setRows([])
    setRaw('')
    setConfirm(null)
    setError(null)
  }, [])

  const load = (next: Revealed) => {
    setEdited(false)
    setRevealed(next)
    setRows(next.original.kind === 'kv' ? rowsFrom(next.original.entries) : [])
    setRaw(next.original.kind === 'json' || next.original.kind === 'text' ? next.original.text : '')
    setMode(next.original.kind === 'kv' ? 'kv' : 'raw')
  }

  // The edited value as a model, or an error string when it can't be saved as-is.
  const draft = useMemo((): ValueModel | string | null => {
    if (!revealed) return null
    const o = revealed.original
    if (o.kind === 'binary') return o
    if (o.kind === 'kv' && mode === 'kv') {
      const r = entriesFrom(rows)
      return r.ok ? { kind: 'kv', entries: r.entries } : r.error
    }
    return toModel(raw, 'string')
  }, [revealed, rows, raw, mode])

  const dirty =
    canEdit &&
    edited &&
    !!revealed &&
    typeof draft === 'object' &&
    draft !== null &&
    serialize(draft) !== serialize(revealed.original)

  // Auto-mask after 30s and when the page is hidden; paused only while the user has real edits.
  // `edited` (not `dirty`): a half-typed row with a blank key isn't a valid draft yet, but it is
  // still work the user would lose.
  useAutoHide(!!revealed && !(canEdit && edited), hide)

  const reveal = () =>
    startTransition(async () => {
      setError(null)
      const res = await revealSecret({ accountId, name })
      if (!res.ok) return setError(res.message)
      load({ versionId: res.data.versionId, original: toModel(res.data.value, res.data.kind) })
    })

  const switchMode = (next: 'kv' | 'raw') => {
    if (next === mode || !revealed || revealed.original.kind !== 'kv') return
    if (next === 'raw') {
      const r = entriesFrom(rows)
      if (!r.ok) return setError(r.error)
      setRaw(JSON.stringify(r.entries, null, 2))
    } else {
      const m = toModel(raw, 'string')
      if (m.kind !== 'kv')
        return setError('Raw JSON must be a flat object of strings to edit as key/value.')
      setRows(rowsFrom(m.entries))
    }
    setError(null)
    setMode(next)
  }

  const askSave = () => {
    if (!revealed || draft === null) return
    if (typeof draft === 'string') return setError(draft)
    // Raw editing of a JSON or key/value secret must stay JSON; a typo must not save as text.
    const wasJson = revealed.original.kind === 'json' || revealed.original.kind === 'kv'
    if (wasJson && (revealed.original.kind === 'json' || mode === 'raw') && !isValidJson(raw)) {
      return setError('The value is not valid JSON.')
    }
    const diff = keyDiff(diffEntries(revealed.original), diffEntries(draft))
    if (!hasChanges(diff)) return
    setConfirm({ diff, value: serialize(draft) })
  }

  const save = () =>
    startTransition(async () => {
      if (!confirm || !revealed?.versionId) return
      const res = await updateSecretValue({
        accountId,
        name,
        value: confirm.value,
        baseVersionId: revealed.versionId,
      })
      setConfirm(null)
      if (!res.ok) {
        if (res.code === 'Conflict') {
          toast.error('The secret changed since you revealed it.', {
            description: 'Your edits were not saved.',
            action: {
              label: 'Reload',
              onClick: () => {
                hide()
                router.refresh()
              },
            },
          })
        } else {
          setError(res.message)
        }
        return
      }
      toast.success('Saved a new version.')
      hide()
      router.refresh()
    })

  if (!revealed) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-14 text-center">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-muted">
          <LockIcon className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <span className="font-medium">Values are hidden</span>
          <span className="text-sm text-muted-foreground">
            Revealing is recorded in the audit log. Values hide again after 30 seconds or when you
            leave the tab.
          </span>
        </div>
        <Button onClick={reveal} disabled={pending}>
          <EyeIcon />
          {pending ? 'Revealing…' : 'Reveal values'}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  }

  const kind = revealed.original.kind
  const readOnly = !canEdit || kind === 'binary'

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex gap-1.5" role="group" aria-label="View">
          {kind === 'kv' ? (
            <>
              <Button
                size="sm"
                variant={mode === 'kv' ? 'default' : 'outline'}
                aria-pressed={mode === 'kv'}
                onClick={() => switchMode('kv')}
              >
                Key / value
              </Button>
              <Button
                size="sm"
                variant={mode === 'raw' ? 'default' : 'outline'}
                aria-pressed={mode === 'raw'}
                onClick={() => switchMode('raw')}
              >
                Raw JSON
              </Button>
            </>
          ) : (
            <span className="text-sm font-medium">
              {kind === 'binary'
                ? 'Binary (base64, read-only)'
                : kind === 'json'
                  ? 'JSON'
                  : 'Plain text'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <ClockIcon className="size-3.5" />
            {canEdit && edited
              ? 'Auto-hide paused while you have unsaved changes'
              : 'Hides in 30s or when you leave the tab'}
          </span>
          <Button size="sm" variant="outline" onClick={hide}>
            <EyeOffIcon />
            Hide
          </Button>
        </div>
      </div>

      {kind === 'kv' && mode === 'kv' ? (
        <KvEditor
          rows={rows}
          onChange={(r) => {
            setRows(r)
            setEdited(true)
          }}
          readOnly={readOnly}
          onCopy={copyWithClear}
        />
      ) : (
        <div className="p-4">
          <Textarea
            aria-label="Secret value"
            value={
              kind === 'binary'
                ? revealed.original.kind === 'binary'
                  ? revealed.original.base64
                  : ''
                : raw
            }
            onChange={(e) => {
              setRaw(e.target.value)
              setEdited(true)
            }}
            readOnly={readOnly}
            spellCheck={false}
            autoComplete="off"
            className={cn(
              'min-h-48 font-mono text-[13px] leading-relaxed',
              readOnly && 'bg-muted/40',
            )}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="border-t px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      {!readOnly && (
        <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-3">
          <span className="text-[13px] text-muted-foreground">
            Editing version <span className="font-mono">{revealed.versionId?.slice(0, 8)}</span>. If
            someone saves first, you’ll be asked to reload.
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!dirty} onClick={() => load(revealed)}>
              Discard
            </Button>
            <Button size="sm" disabled={!dirty || pending} onClick={askSave}>
              Save new version
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save a new version?</AlertDialogTitle>
            <AlertDialogDescription>
              This becomes AWSCURRENT for <span className="font-mono">{name}</span>. The previous
              version stays available for rollback.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirm && <KeyDiffList diff={confirm.diff} />}
          <p className="text-xs text-muted-foreground">
            Only key names are shown here. Values never appear in this summary.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={save} disabled={pending}>
              Save version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
