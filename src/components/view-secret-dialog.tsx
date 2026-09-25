'use client'

import { CopyIcon, EyeIcon, EyeOffIcon } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { revealSecret } from '@/lib/actions/secrets'
import { copyWithClear } from '@/lib/ui/clipboard'
import { markEditIntent } from '@/lib/ui/edit-intent'
import { serialize, toModel, type ValueModel } from '@/lib/ui/secret-value'
import { cn } from '@/lib/utils'
import { useAutoHide } from './use-auto-hide'
import { useCountdown } from './use-countdown'

/**
 * Quick view from a secret card. Opening it is the audited read (the same `revealSecret` action as
 * the detail page). The value lives in this component's state only and is dropped after 30s, when
 * the tab is hidden, or when the dialog closes.
 */
export function ViewSecretDialog({
  accountId,
  name,
  upn,
  detailHref,
  canEdit,
}: {
  accountId: string
  name: string
  /** Who the view is recorded as. */
  upn: string
  detailHref: string
  canEdit: boolean
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<ValueModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [raw, setRaw] = useState(false)
  const [pending, startTransition] = useTransition()
  // Bumped on every open and close: a response for an older request is dropped, so a value never
  // lands in state after the dialog was closed (or reappears on the next open).
  const request = useRef(0)

  const close = useCallback(() => {
    request.current++
    setOpen(false)
    setValue(null)
    setError(null)
    setRaw(false)
  }, [])
  useAutoHide(!!value, close)
  const left = useCountdown(!!value, value)

  const view = () => {
    const id = ++request.current
    setValue(null)
    setError(null)
    setOpen(true)
    startTransition(async () => {
      const res = await revealSecret({ accountId, name })
      if (id !== request.current) return
      if (!res.ok) return setError(res.message)
      setValue(toModel(res.data.value, res.data.kind))
    })
  }

  const entries = value?.kind === 'kv' ? Object.entries(value.entries) : null
  return (
    <>
      <Button onClick={view} disabled={pending}>
        <EyeIcon />
        View secret
      </Button>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="gap-[18px] sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              View secret: <span className="font-mono text-lg">{name}</span>
            </DialogTitle>
            <DialogDescription>
              {value
                ? `This view was recorded in CloudTrail as ${upn}.`
                : error
                  ? 'Nothing was shown.'
                  : 'Loading…'}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {value && (
            <>
              <div className="flex items-center gap-3">
                <div
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                  aria-hidden="true"
                >
                  <div
                    className="h-full bg-primary transition-[width] duration-300"
                    style={{ width: `${(left / 30) * 100}%` }}
                  />
                </div>
                <span className="text-[13px] whitespace-nowrap text-muted-foreground">
                  Hides in <strong className="text-foreground tabular">{left}s</strong>
                </span>
              </div>
              <div className="overflow-hidden rounded-lg bg-code-bg text-code-fg">
                <div className="flex h-11 items-center justify-between pr-3 pl-5">
                  <span className="text-xs font-semibold tracking-[.04em] text-code-meta uppercase">
                    {entries
                      ? `${entries.length} ${entries.length === 1 ? 'key' : 'keys'}`
                      : value.kind === 'binary'
                        ? 'Binary (base64, read-only)'
                        : value.kind === 'json'
                          ? 'JSON'
                          : 'Plain text'}
                  </span>
                  {entries && (
                    <div
                      role="group"
                      aria-label="View as"
                      className="flex gap-0.5 rounded-[7px] bg-white/5 p-[3px]"
                    >
                      {(['Key / value', 'Raw JSON'] as const).map((label, i) => {
                        const on = raw === (i === 1)
                        return (
                          <button
                            key={label}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setRaw(i === 1)}
                            className={cn(
                              'h-7 rounded-[5px] px-2.5 text-xs font-medium',
                              on ? 'bg-white/15 text-white' : 'text-code-meta hover:text-white',
                            )}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                {entries && !raw ? (
                  <div className="max-h-[320px] overflow-y-auto">
                    {entries.map(([k, v]) => (
                      <div
                        key={k}
                        className="grid h-10 grid-cols-[160px_minmax(0,1fr)_32px] items-center gap-3 border-t border-white/[.07] pr-3 pl-5 font-mono text-[13px]"
                      >
                        <span className="truncate text-code-key" title={k}>
                          {k}
                        </span>
                        <span className="truncate">{v}</span>
                        <button
                          type="button"
                          aria-label={`Copy value of ${k}`}
                          title={`Copy value of ${k}`}
                          onClick={() => copyWithClear(v)}
                          className="inline-flex size-[30px] items-center justify-center rounded-md text-code-meta hover:bg-white/10 hover:text-white"
                        >
                          <CopyIcon className="size-[15px]" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre
                    aria-label="Secret value"
                    className="max-h-[320px] overflow-auto border-t border-white/[.07] px-5 py-3 font-mono text-[13px] break-all whitespace-pre-wrap"
                  >
                    {value.kind === 'binary'
                      ? value.base64
                      : value.kind === 'kv'
                        ? JSON.stringify(value.entries, null, 2)
                        : value.text}
                  </pre>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button onClick={() => copyWithClear(serialize(value))}>
                  <CopyIcon />
                  {value.kind === 'kv' || value.kind === 'json' ? 'Copy as JSON' : 'Copy value'}
                </Button>
                <Button variant="secondary" onClick={close}>
                  <EyeOffIcon />
                  Hide now
                </Button>
                <div className="flex-1" />
                <Button asChild variant="text">
                  <Link href={detailHref}>Open details</Link>
                </Button>
                {canEdit && value.kind !== 'binary' && (
                  <Button asChild variant="success">
                    <Link
                      href={`${detailHref}${detailHref.includes('?') ? '&' : '?'}edit=1`}
                      onClick={() => markEditIntent(accountId, name)}
                    >
                      Edit secret
                    </Link>
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
