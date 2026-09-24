'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { updateTags } from '@/lib/actions/secrets'
import { newRow as newTagRow, tagChanges, type TagRow } from '@/lib/ui/editor-model'
import { TagRowsEditor } from './tag-rows-editor'

export function TagsPanel({
  accountId,
  name,
  tags,
  canEdit,
}: {
  accountId: string
  name: string
  tags: Record<string, string>
  canEdit: boolean
}) {
  const router = useRouter()
  const initial = () => Object.entries(tags).map(([k, v]) => newTagRow(k, v))
  const [rows, setRows] = useState<TagRow[]>(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const change = tagChanges(tags, rows)
  const dirty = change.ok ? Object.keys(change.set).length + change.remove.length > 0 : true

  const save = () =>
    startTransition(async () => {
      if (!change.ok) return setError(change.error)
      setError(null)
      const res = await updateTags({ accountId, name, set: change.set, remove: change.remove })
      if (!res.ok) return setError(res.message)
      toast.success('Tags saved.')
      router.refresh()
    })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-w-3xl flex-col gap-3 rounded-xl border bg-card p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px] gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <span>Key</span>
          <span>Value</span>
        </div>
        {rows.length === 0 && !canEdit && (
          <span className="text-sm text-muted-foreground">No tags.</span>
        )}
        <TagRowsEditor rows={rows} onChange={setRows} readOnly={!canEdit} />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {canEdit && (
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              disabled={!dirty || pending}
              onClick={() => {
                setRows(initial())
                setError(null)
              }}
            >
              Discard
            </Button>
            <Button size="sm" disabled={!dirty || pending} onClick={save}>
              {pending ? 'Saving…' : 'Save tags'}
            </Button>
          </div>
        )}
      </div>
      <p className="text-[13px] text-muted-foreground">
        {canEdit
          ? 'Keys starting with '
          : 'Readers can see tags but not edit them. Keys starting with '}
        <span className="font-mono">aws:</span> are reserved.
      </p>
    </div>
  )
}
