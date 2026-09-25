'use client'

import { CopyIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { newRow, type KvRow } from '@/lib/ui/editor-model'
import { cn } from '@/lib/utils'
import { BadgeTag } from './badge-tag'

const input =
  'h-[34px] w-full rounded-lg border bg-background px-2.5 font-mono text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 read-only:border-transparent read-only:bg-transparent read-only:px-0'

/**
 * Key/value editor.
 * - `original`: when editing an existing secret, rows whose id is in `lockedIds` show their key as
 *   text (rename = remove + add); changed values get a CHANGED badge, added rows a NEW badge.
 * - `masked` renders values as password inputs; `readOnly` hides editing controls.
 * - `onCopy` copies a value (best-effort clipboard clear is the caller's job).
 */
export function KvEditor({
  rows,
  onChange,
  masked,
  readOnly,
  onCopy,
  original,
  lockedIds,
}: {
  rows: KvRow[]
  onChange: (rows: KvRow[]) => void
  masked?: boolean
  readOnly?: boolean
  onCopy?: (value: string) => void
  original?: Record<string, string>
  lockedIds?: ReadonlySet<string>
}) {
  const update = (id: string, patch: Partial<KvRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const grid = 'grid grid-cols-[240px_minmax(0,1fr)_72px] items-center gap-3 px-4'

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          grid,
          'bg-sunken py-2.5 text-[11px] font-semibold tracking-[.06em] text-muted-foreground uppercase',
        )}
      >
        <span>Key</span>
        <span>Value</span>
        <span className="sr-only">Actions</span>
      </div>
      {rows.map((r) => {
        const locked = lockedIds?.has(r.id) ?? false
        const isNew = !!original && !locked && !Object.hasOwn(original, r.key)
        const changed =
          locked && !!original && Object.hasOwn(original, r.key) && original[r.key] !== r.value
        return (
          <div key={r.id} className={cn(grid, 'border-t py-2')}>
            <div className="flex min-w-0 items-center gap-2">
              {locked || readOnly ? (
                <span className="truncate font-mono text-[13px]" title={r.key}>
                  {r.key}
                </span>
              ) : (
                <input
                  aria-label="Key"
                  value={r.key}
                  onChange={(e) => update(r.id, { key: e.target.value })}
                  className={input}
                />
              )}
              {changed && <BadgeTag tone="amber">changed</BadgeTag>}
              {isNew && !readOnly && <BadgeTag tone="green">new</BadgeTag>}
            </div>
            <input
              aria-label={`Value for ${r.key || 'new key'}`}
              type={masked ? 'password' : 'text'}
              autoComplete="off"
              spellCheck={false}
              value={r.value}
              readOnly={readOnly}
              onChange={(e) => update(r.id, { value: e.target.value })}
              className={cn(input, changed && 'border-amber-600 dark:border-amber-700')}
            />
            <div className="flex justify-end gap-0.5">
              {onCopy && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Copy value for ${r.key}`}
                  title={`Copy value of ${r.key}`}
                  onClick={() => onCopy(r.value)}
                >
                  <CopyIcon />
                </Button>
              )}
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon-sm"
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
        <div className="border-t px-4 py-2.5">
          <Button
            variant="outline"
            size="sm"
            className="border-dashed bg-transparent text-muted-foreground"
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
