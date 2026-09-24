'use client'

import { PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createSecret } from '@/lib/actions/secrets'
import { secretHref } from '@/lib/ui/format'
import { isValidJson } from '@/lib/ui/secret-value'
import { cn } from '@/lib/utils'
import { entriesFrom, newRow, tagChanges, type KvRow, type TagRow } from '@/lib/ui/editor-model'
import { KvEditor } from './kv-editor'
import { TagRowsEditor } from './tag-rows-editor'

type Kind = 'kv' | 'json' | 'text'
const NAME_RE = /^[A-Za-z0-9/_+=.@-]{1,512}$/

export function CreateSecretDialog({
  accountId,
  accountName,
}: {
  accountId: string
  accountName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<Kind>('kv')
  const [rows, setRows] = useState<KvRow[]>([newRow()])
  const [raw, setRaw] = useState('')
  const [tags, setTags] = useState<TagRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName('')
    setDescription('')
    setKind('kv')
    setRows([newRow()])
    setRaw('')
    setTags([])
    setError(null)
  }

  const submit = () => {
    setError(null)
    if (!NAME_RE.test(name)) return setError('Use letters, digits and / _ + = . @ - only.')
    let value: string
    if (kind === 'kv') {
      const r = entriesFrom(rows)
      if (!r.ok) return setError(r.error)
      value = JSON.stringify(r.entries)
    } else {
      if (!raw) return setError('Enter a value.')
      if (kind === 'json' && !isValidJson(raw)) return setError('The value is not valid JSON.')
      value = raw
    }
    const t = tagChanges({}, tags)
    if (!t.ok) return setError(t.error)
    startTransition(async () => {
      const res = await createSecret({
        accountId,
        name,
        description: description || undefined,
        value,
        tags: t.set,
      })
      if (!res.ok) return setError(res.message)
      toast.success(`Created ${name}`)
      setOpen(false)
      reset()
      router.push(secretHref(accountId, name))
    })
  }

  const kindButton = (k: Kind, label: string) => (
    <Button
      type="button"
      size="sm"
      variant={kind === k ? 'default' : 'outline'}
      aria-pressed={kind === k}
      onClick={() => setKind(k)}
    >
      {label}
    </Button>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PlusIcon />
          New secret
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>New secret in {accountName}</DialogTitle>
          <DialogDescription>
            The value is stored in AWS Secrets Manager and never logged.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="secret-name">Name</Label>
            <Input
              id="secret-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="team/app/purpose"
              className="font-mono"
              aria-describedby="secret-name-hint"
              autoFocus
            />
            <span id="secret-name-hint" className="text-xs text-muted-foreground">
              Use a path like <span className="font-mono">team/app/purpose</span>. Letters, digits
              and / _ + = . @ - only.
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="secret-description">Description</Label>
            <Input
              id="secret-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this for? (optional)"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Value type</span>
            <div className="flex gap-1.5" role="group" aria-label="Value type">
              {kindButton('kv', 'Key / value')}
              {kindButton('json', 'JSON')}
              {kindButton('text', 'Plain text')}
            </div>
            <div className={cn('overflow-hidden rounded-lg border', kind !== 'kv' && 'hidden')}>
              <KvEditor rows={rows} onChange={setRows} masked />
            </div>
            {kind !== 'kv' && (
              <Textarea
                aria-label={kind === 'json' ? 'JSON value' : 'Plain text value'}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                className="min-h-32 font-mono text-sm"
                placeholder={kind === 'json' ? '{ "key": "value" }' : ''}
              />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">
              Tags <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <TagRowsEditor rows={tags} onChange={setTags} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create secret'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
