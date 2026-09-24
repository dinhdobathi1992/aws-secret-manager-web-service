'use client'

import { PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { newRow as newTagRow, type TagRow } from '@/lib/ui/editor-model'

export function TagRowsEditor({
  rows,
  onChange,
  readOnly,
}: {
  rows: TagRow[]
  onChange: (rows: TagRow[]) => void
  readOnly?: boolean
}) {
  const update = (id: string, patch: Partial<TagRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px] gap-2">
          <Input
            aria-label="Tag key"
            placeholder="key"
            value={r.key}
            readOnly={readOnly}
            onChange={(e) => update(r.id, { key: e.target.value })}
            className="font-mono"
          />
          <Input
            aria-label={`Value for tag ${r.key || 'new'}`}
            placeholder="value"
            value={r.value}
            readOnly={readOnly}
            onChange={(e) => update(r.id, { value: e.target.value })}
            className="font-mono"
          />
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove tag ${r.key}`}
              onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
            >
              <Trash2Icon />
            </Button>
          )}
        </div>
      ))}
      {!readOnly && (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([...rows, newTagRow()])}
          >
            <PlusIcon />
            Add tag
          </Button>
        </div>
      )}
    </div>
  )
}
