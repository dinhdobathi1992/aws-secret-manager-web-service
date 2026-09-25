'use client'

import { InfoIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { updateTags } from '@/lib/actions/secrets'
import { newRow as newTagRow, tagChanges, type TagRow } from '@/lib/ui/editor-model'
import { cn } from '@/lib/utils'
import { BadgeTag } from './badge-tag'

const input =
  'h-[34px] w-full rounded-lg border bg-background px-2.5 font-mono text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 read-only:border-transparent read-only:bg-transparent read-only:px-0'

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
  const changes = change.ok ? Object.keys(change.set).length + change.remove.length : 0
  const dirty = change.ok ? changes > 0 : true
  const update = (id: string, patch: Partial<TagRow>) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const save = () =>
    startTransition(async () => {
      if (!change.ok) return setError(change.error)
      setError(null)
      const res = await updateTags({ accountId, name, set: change.set, remove: change.remove })
      if (!res.ok) return setError(res.message)
      toast.success('Tags saved.')
      router.refresh()
    })

  const grid = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_72px] items-center gap-2'
  return (
    <div className="flex flex-wrap items-start gap-6">
      <section aria-label="Tags" className="w-full max-w-[760px] overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-2 p-4">
          <div
            className={cn(
              grid,
              'text-[11px] font-semibold tracking-[.06em] text-muted-foreground uppercase',
            )}
          >
            <span>Key</span>
            <span>Value</span>
            <span />
          </div>
          {rows.length === 0 && <span className="text-sm text-muted-foreground">No tags.</span>}
          {rows.map((r) => {
            const isNew = !Object.hasOwn(tags, r.key) || r.key === ''
            return (
              <div key={r.id} className={grid}>
                <input
                  aria-label="Tag key"
                  placeholder="key"
                  value={r.key}
                  readOnly={!canEdit}
                  onChange={(e) => update(r.id, { key: e.target.value })}
                  className={input}
                />
                <input
                  aria-label={`Value for tag ${r.key || 'new'}`}
                  placeholder="value"
                  value={r.value}
                  readOnly={!canEdit}
                  onChange={(e) => update(r.id, { value: e.target.value })}
                  className={input}
                />
                <div className="flex items-center gap-1">
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove tag ${r.key}`}
                      title={`Remove tag ${r.key}`}
                      onClick={() => setRows(rows.filter((x) => x.id !== r.id))}
                    >
                      <Trash2Icon />
                    </Button>
                  )}
                  {canEdit && isNew && <BadgeTag tone="green">new</BadgeTag>}
                </div>
              </div>
            )
          })}
          {canEdit && (
            <div className="mt-1">
              <Button
                variant="outline"
                size="sm"
                className="border-dashed bg-transparent text-muted-foreground"
                onClick={() => setRows([...rows, newTagRow()])}
              >
                <PlusIcon />
                Add tag
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 border-t bg-sunken px-4 py-3">
            <span
              className={cn('size-[7px] rounded-full', dirty ? 'bg-amber-500' : 'bg-zinc-500')}
            />
            <span className="text-[13px] text-muted-foreground">
              {!change.ok
                ? change.error
                : changes
                  ? `${changes} unsaved ${changes === 1 ? 'change' : 'changes'}`
                  : 'No unsaved changes'}
            </span>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!dirty || pending}
              onClick={() => {
                setRows(initial())
                setError(null)
              }}
            >
              Discard
            </Button>
            <Button
              size="sm"
              className="h-8 px-3.5"
              disabled={!dirty || pending || !change.ok}
              onClick={save}
            >
              {pending ? 'Saving…' : 'Save tags'}
            </Button>
          </div>
        )}
      </section>
      <aside className="flex max-w-[360px] flex-col gap-2.5 text-[13px] text-muted-foreground">
        <p className="flex gap-2">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Tags are metadata. Saving them doesn’t create a new version or touch the value.
          </span>
        </p>
        <p className="flex gap-2">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Keys starting with <span className="font-mono text-foreground">aws:</span> are reserved,
            in any letter case.
          </span>
        </p>
        {!canEdit && (
          <p className="flex gap-2">
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            <span>Your role can see tags but not edit them.</span>
          </p>
        )}
      </aside>
    </div>
  )
}
