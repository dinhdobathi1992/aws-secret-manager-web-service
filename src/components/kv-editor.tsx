'use client'

import { CopyIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { newRow, type KvRow } from '@/lib/ui/editor-model'
import { cn } from '@/lib/utils'
import { BadgeTag } from './badge-tag'

const input =
  'h-10 w-full rounded-lg border bg-card px-3 font-mono text-[13px] text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30 read-only:border-transparent read-only:bg-transparent read-only:px-0'

/**
 * Key/value editor.
 * - `form` variant (create dialog): no header, every key is an input.
 * - `panel` variant (value tab): header row; with `original`, rows whose id is in `lockedIds` show
 *   their key as text (rename = remove + add); changed values get a CHANGED badge and an amber
 *   border, added rows a NEW badge.
 * - `masked` hides values (all, or per key); `placeholderFor` gives example text per key.
 * - `onCopy` copies a value (best-effort clipboard clear is the caller's job).
 */
export function KvEditor({
  rows,
  onChange,
  masked,
  placeholderFor,
  readOnly,
  onCopy,
  original,
  lockedIds,
  variant = 'panel',
}: {
  rows: KvRow[]
  onChange: (rows: KvRow[]) => void
  masked?: boolean | ((key: string) => boolean)
  placeholderFor?: (key: string) => string | undefined
  readOnly?: boolean
  onCopy?: (value: string) => void
  original?: Record<string, string>
  lockedIds?: ReadonlySet<string>
  variant?: 'panel' | 'form'
}) {
  const update = (id: string, patch: Partial<KvRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const form = variant === 'form'
  const grid = form
    ? 'grid grid-cols-[200px_minmax(0,1fr)_32px] items-center gap-2'
    : 'grid grid-cols-[220px_minmax(0,1fr)_72px] items-center gap-3 px-6'
  const isMasked = (key: string) => (typeof masked === 'function' ? masked(key) : !!masked)

  return (
    <div className={cn('flex flex-col', form && 'gap-2')}>
      {!form && (
        <div
          className={cn(
            grid,
            'pt-3 pb-2 text-xs font-semibold tracking-[.04em] text-muted-foreground uppercase',
          )}
        >
          <span>Key</span>
          <span>Value</span>
          <span className="sr-only">Actions</span>
        </div>
      )}
      {rows.map((r, i) => {
        const locked = lockedIds?.has(r.id) ?? false
        const isNew = !!original && !locked && !Object.hasOwn(original, r.key)
        const changed =
          locked && !!original && Object.hasOwn(original, r.key) && original[r.key] !== r.value
        return (
          <div
            key={r.id}
            className={cn(grid, !form && 'border-t border-[#f1f2f5] py-2.5 dark:border-border')}
          >
            <div className="flex min-w-0 items-center gap-2">
              {locked || readOnly ? (
                <span className="truncate font-mono text-[13px] text-foreground" title={r.key}>
                  {r.key}
                </span>
              ) : (
                <input
                  aria-label="Key"
                  value={r.key}
                  placeholder="key"
                  onChange={(e) => update(r.id, { key: e.target.value })}
                  className={input}
                />
              )}
              {changed && <BadgeTag tone="amber">changed</BadgeTag>}
              {isNew && !readOnly && <BadgeTag tone="green">new</BadgeTag>}
            </div>
            <input
              aria-label={`Value for ${r.key || `new key ${i + 1}`}`}
              type={isMasked(r.key) ? 'password' : 'text'}
              autoComplete="off"
              spellCheck={false}
              value={r.value}
              placeholder={placeholderFor?.(r.key)}
              readOnly={readOnly}
              onChange={(e) => update(r.id, { value: e.target.value })}
              className={cn(input, changed && 'border-amber-500 dark:border-amber-600')}
            />
            <div className="flex justify-end gap-0.5">
              {onCopy && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Copy value for ${r.key}`}
                  title={`Copy value of ${r.key}`}
                  onClick={() => onCopy(r.value)}
                >
                  <CopyIcon />
                </Button>
              )}
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove key ${r.key}`}
                  title={`Remove key ${r.key}`}
                  onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
                >
                  <Trash2Icon />
                </Button>
              )}
            </div>
          </div>
        )
      })}
      {!readOnly && (
        <div className={cn(!form && 'border-t border-[#f1f2f5] px-6 py-3 dark:border-border')}>
          <Button
            type="button"
            variant="dashed"
            size="sm"
            onClick={() => onChange([...rows, newRow()])}
          >
            <PlusIcon />
            Add key
          </Button>
        </div>
      )}
    </div>
  )
}
