'use client'

import { CopyIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { newRow, type KvRow } from '@/lib/ui/editor-model'

/**
 * Key/value editor. `masked` renders values as password inputs; `readOnly` hides editing controls.
 * `onCopy` copies a value (best-effort clipboard clear is the caller's job).
 */
export function KvEditor({
  rows,
  onChange,
  masked,
  readOnly,
  onCopy,
}: {
  rows: KvRow[]
  onChange: (rows: KvRow[]) => void
  masked?: boolean
  readOnly?: boolean
  onCopy?: (value: string) => void
}) {
  const update = (id: string, patch: Partial<KvRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[minmax(0,30%)_minmax(0,1fr)_88px] gap-3 border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <span>Key</span>
        <span>Value</span>
        <span className="sr-only">Actions</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.id}
          className="grid grid-cols-[minmax(0,30%)_minmax(0,1fr)_88px] items-center gap-3 border-b border-border/60 px-4 py-2"
        >
          <Input
            aria-label="Key"
            value={r.key}
            readOnly={readOnly}
            onChange={(e) => update(r.id, { key: e.target.value })}
            className="h-9 font-mono font-medium read-only:border-transparent read-only:bg-transparent read-only:shadow-none"
          />
          <Input
            aria-label={`Value for ${r.key || 'new key'}`}
            type={masked ? 'password' : 'text'}
            autoComplete="off"
            spellCheck={false}
            value={r.value}
            readOnly={readOnly}
            onChange={(e) => update(r.id, { value: e.target.value })}
            className="h-9 font-mono read-only:border-transparent read-only:bg-transparent read-only:shadow-none"
          />
          <div className="flex justify-end gap-0.5">
            {onCopy && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Copy value for ${r.key}`}
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
                onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
              >
                <Trash2Icon />
              </Button>
            )}
          </div>
        </div>
      ))}
      {!readOnly && (
        <div className="px-4 py-2.5">
          <Button variant="outline" size="sm" onClick={() => onChange([...rows, newRow()])}>
            <PlusIcon />
            Add key
          </Button>
        </div>
      )}
    </div>
  )
}
