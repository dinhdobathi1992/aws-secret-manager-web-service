'use client'

import { ClockIcon, EyeIcon, EyeOffIcon, LockIcon, RefreshCwIcon, XIcon } from 'lucide-react'
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
import { SaveSummary } from './key-diff-list'
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
  upn,
}: {
  accountId: string
  name: string
  canEdit: boolean
  /** Shown in the hidden state: who the reveal will be recorded as. */
  upn: string
}) {
  const router = useRouter()
  const [revealed, setRevealed] = useState<Revealed | null>(null)
  const [rows, setRows] = useState<KvRow[]>([])
  // Rows that came from the stored value: their keys are fixed (rename = remove + add).
  const [lockedIds, setLockedIds] = useState<ReadonlySet<string>>(new Set())
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
    const loaded = next.original.kind === 'kv' ? rowsFrom(next.original.entries) : []
    setRows(loaded)
    setLockedIds(new Set(loaded.map((r) => r.id)))
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

  // Key-level summary of unsaved edits for the footer (names only).
  const liveDiff = useMemo(
    () =>
      revealed && typeof draft === 'object' && draft !== null
        ? keyDiff(diffEntries(revealed.original), diffEntries(draft))
        : null,
    [revealed, draft],
  )

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
      const back = rowsFrom(m.entries)
      const orig = revealed.original.entries
      setRows(back)
      setLockedIds(new Set(back.filter((r) => Object.hasOwn(orig, r.key)).map((r) => r.id)))
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
      <section
        aria-label="Value"
        className="flex items-center gap-4 rounded-xl border bg-card px-6 py-5"
      >
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-muted">
          <LockIcon className="size-[18px]" />
        </span>
        <div className="flex flex-1 flex-col gap-1">
          <h2 className="text-[15px] font-semibold">Values are hidden</h2>
          <p className="text-[13px] text-muted-foreground">
            Revealing is recorded in CloudTrail as <span className="text-foreground">{upn}</span>.
            Values hide again after 30 seconds or when you leave the tab.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <Button onClick={reveal} disabled={pending} className="h-9 px-3.5">
          <EyeIcon />
          {pending ? 'Revealing…' : 'Reveal values'}
        </Button>
      </section>
    )
  }

  const kind = revealed.original.kind
  const readOnly = !canEdit || kind === 'binary'
  const paused = canEdit && edited
  const summary = (() => {
    if (!dirty) return null
    // Key counts only make sense key/value → key/value (raw JSON that doesn't parse is text).
    const kvToKv =
      revealed?.original.kind === 'kv' && typeof draft === 'object' && draft?.kind === 'kv'
    if (!liveDiff || !kvToKv) return 'Value changed.'
    const groups = (
      [
        ['changed', liveDiff.changed.length],
        ['added', liveDiff.added.length],
        ['removed', liveDiff.removed.length],
      ] as const
    ).filter(([, n]) => n > 0)
    if (groups.length === 0) return 'Value changed.' // e.g. only the key order
    if (groups.length === 1) {
      const [label, n] = groups[0]
      return `${n} ${n === 1 ? 'key' : 'keys'} ${label}.`
    }
    return `${groups.map(([label, n]) => `${n} ${label}`).join(', ')}.`
  })()
  const segment = (on: boolean) =>
    cn(
      'h-7 rounded-md px-3 text-[13px] font-medium',
      on ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
    )

  return (
    <section aria-label="Value" className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-3 border-b px-4 py-2.5">
        {kind === 'kv' ? (
          <div
            role="group"
            aria-label="View as"
            className="flex gap-0.5 rounded-lg border bg-background p-0.5"
          >
            <button
              type="button"
              aria-pressed={mode === 'kv'}
              onClick={() => switchMode('kv')}
              className={segment(mode === 'kv')}
            >
              Key / value
            </button>
            <button
              type="button"
              aria-pressed={mode === 'raw'}
              onClick={() => switchMode('raw')}
              className={segment(mode === 'raw')}
            >
              Raw JSON
            </button>
          </div>
        ) : (
          <span className="text-[13px] font-medium">
            {kind === 'binary'
              ? 'Binary (base64, read-only)'
              : kind === 'json'
                ? 'JSON'
                : 'Plain text'}
          </span>
        )}
        <div className="flex-1" />
        <span
          className={cn(
            'inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-xs font-medium',
            paused
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <ClockIcon className="size-3.5" />
          {paused
            ? 'Auto-hide paused while you have unsaved changes'
            : 'Hides in 30s or when you leave the tab'}
        </span>
        <Button size="sm" variant="outline" className="h-8" onClick={hide}>
          <EyeOffIcon />
          Hide
        </Button>
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
          original={revealed.original.kind === 'kv' ? revealed.original.entries : undefined}
          lockedIds={lockedIds}
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
              'min-h-48 bg-background font-mono text-[13px] leading-relaxed',
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
        <div className="flex items-center gap-2 border-t bg-sunken px-4 py-3">
          <span
            className={cn(
              'size-[7px] shrink-0 rounded-full',
              dirty ? 'bg-amber-500' : 'bg-zinc-500',
            )}
          />
          <span className="text-[13px] text-muted-foreground">
            {summary
              ? `${summary} Saving creates a new version; the current one becomes AWSPREVIOUS.`
              : 'No unsaved changes. If someone saves first, you’ll be asked to reload.'}
          </span>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!dirty}
            onClick={() => load(revealed)}
          >
            Discard
          </Button>
          <Button size="sm" className="h-8 px-3.5" disabled={!dirty || pending} onClick={askSave}>
            Save new version…
          </Button>
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="sm:max-w-[520px]">
          <AlertDialogHeader className="relative pr-8">
            <AlertDialogTitle>Save a new version?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-foreground">{name}</span> gets a new AWSCURRENT
              version. The current version becomes AWSPREVIOUS and can be made current again.
            </AlertDialogDescription>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close"
              className="absolute top-0 right-0 text-muted-foreground"
              onClick={() => setConfirm(null)}
            >
              <XIcon />
            </Button>
          </AlertDialogHeader>
          {confirm && <SaveSummary diff={confirm.diff} />}
          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <p className="flex items-center gap-2">
              <EyeOffIcon className="size-3.5" />
              Only key names are listed here. Values never appear in this summary.
            </p>
            <p className="flex items-center gap-2">
              <RefreshCwIcon className="size-3.5" />
              If someone changed the secret since you revealed it, the save stops and asks you to
              reload.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={save} disabled={pending}>
              Save version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
