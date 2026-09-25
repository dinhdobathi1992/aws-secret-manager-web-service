'use client'

import { ClockIcon, EyeIcon, EyeOffIcon, LockIcon, RefreshCwIcon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
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
import { copyWithClear } from '@/lib/ui/clipboard'
import { takeEditIntent } from '@/lib/ui/edit-intent'
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
import { useCountdown } from './use-countdown'

type Revealed = { versionId?: string; original: ValueModel }

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
  autoView,
}: {
  accountId: string
  name: string
  canEdit: boolean
  /**
   * `?edit=1` from the quick view's "Edit secret". The (audited) view runs on load only if that
   * click left a one-time intent in this tab, so a crafted link, refresh or Back never views.
   */
  autoView?: boolean
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
  const left = useCountdown(!!revealed && !(canEdit && edited), revealed)

  const reveal = () =>
    startTransition(async () => {
      setError(null)
      const res = await revealSecret({ accountId, name })
      if (!res.ok) return setError(res.message)
      load({ versionId: res.data.versionId, original: toModel(res.data.value, res.data.kind) })
    })

  // One view on arrival from "Edit secret", then drop `edit=1` from the URL.
  const autoViewed = useRef(false)
  useEffect(() => {
    if (!autoView || autoViewed.current) return
    autoViewed.current = true
    const intended = canEdit && takeEditIntent(accountId, name)
    router.replace(window.location.pathname, { scroll: false })
    if (intended) reveal()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, [])

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
          toast.error('The secret changed since you opened it.', {
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
        className="surface flex flex-col items-start gap-[18px] px-7 py-6 sm:flex-row sm:items-center"
      >
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
          <LockIcon className="size-[22px]" />
        </span>
        <div className="flex flex-1 flex-col gap-1">
          <h2 className="text-[17px] font-semibold text-foreground">Values are hidden</h2>
          <p className="text-sm text-muted-foreground">
            Viewing is recorded in CloudTrail as{' '}
            <strong className="font-medium text-label">{upn}</strong>. Values hide again after 30
            seconds or when you leave the tab.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <Button size="lg" onClick={reveal} disabled={pending}>
          <EyeIcon />
          {pending ? 'Opening…' : 'View secret'}
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
      'h-8 rounded-md px-3 text-[13px] font-medium',
      on
        ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,.08)]'
        : 'text-muted-foreground hover:text-foreground',
    )

  return (
    <section aria-label="Value" className="surface overflow-hidden">
      <div className="flex items-center gap-3 border-b px-6 py-3.5">
        {kind === 'kv' ? (
          <div
            role="group"
            aria-label="View as"
            className="flex gap-0.5 rounded-lg bg-[#eceef3] p-[3px] dark:bg-muted"
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
            'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium',
            paused
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <ClockIcon className="size-3.5" />
          {paused ? (
            'Auto-hide paused while you have unsaved changes'
          ) : (
            <span>
              Hides in <strong className="tabular">{left}s</strong> or when you leave the tab
            </span>
          )}
        </span>
        <Button variant="secondary" className="h-9" onClick={hide}>
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
        <div className="px-6 py-4">
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
        <p role="alert" className="border-t px-6 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      {!readOnly && dirty && (
        <div className="flex items-center gap-2.5 border-t bg-sunken px-6 py-4">
          <span className="size-2 shrink-0 rounded-full bg-amber-500" />
          <span className="text-sm text-muted-foreground">
            {summary} Saving creates a new version; the current one becomes AWSPREVIOUS.
          </span>
          <div className="flex-1" />
          <Button variant="secondary" onClick={() => load(revealed)}>
            Discard
          </Button>
          <Button variant="success" disabled={pending} onClick={askSave}>
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
              If someone changed the secret since you opened it, the save stops and asks you to
              reload.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="success" onClick={save} disabled={pending}>
              Save version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
