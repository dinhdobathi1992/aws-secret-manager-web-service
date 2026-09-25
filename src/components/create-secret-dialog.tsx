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
import {
  applyTemplate,
  isMaskedKey,
  placeholderFor,
  TEMPLATES,
  type TemplateId,
} from '@/lib/ui/secret-templates'
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
  const [template, setTemplate] = useState<TemplateId>('other')
  const [kind, setKind] = useState<Kind>('kv')
  const [rows, setRows] = useState<KvRow[]>([newRow()])
  const [showTags, setShowTags] = useState(false)
  const [raw, setRaw] = useState('')
  const [tags, setTags] = useState<TagRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName('')
    setDescription('')
    setTemplate('other')
    setKind('kv')
    setRows([newRow()])
    setRaw('')
    setTags([])
    setShowTags(false)
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

  const pickTemplate = (t: TemplateId) => {
    setTemplate(t)
    setKind('kv')
    setRows(applyTemplate(t, rows).map((r) => newRow(r.key, r.value)))
  }

  const kindButton = (k: Kind, label: string) => (
    <button
      type="button"
      aria-pressed={kind === k}
      onClick={() => setKind(k)}
      className={cn(
        'inline-flex h-7 items-center rounded-md px-3 text-[13px] font-medium',
        kind === k
          ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,.08)]'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
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
        <Button variant="success" size="lg">
          <PlusIcon />
          Create secret
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] gap-[18px] overflow-y-auto p-8 sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Create new secret</DialogTitle>
          <DialogDescription>
            In {accountName}. The value is stored in AWS Secrets Manager and never logged.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-[18px]"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="secret-name" className="text-label">
                Secret name
              </Label>
              <Input
                id="secret-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="team/app/purpose"
                className="h-10 font-mono text-[13px]"
                aria-describedby="secret-name-hint"
                autoFocus
              />
              <span id="secret-name-hint" className="text-xs text-muted-foreground">
                Letters, numbers and / _ + = . @ -
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="secret-description" className="text-label">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="secret-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this secret for?"
                className="h-10"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-label">Secret type</span>
            <div
              role="group"
              aria-label="Secret type"
              className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              {(Object.keys(TEMPLATES) as TemplateId[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={template === t}
                  onClick={() => pickTemplate(t)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-lg border-2 px-4 py-3.5 text-left',
                    template === t
                      ? 'border-primary bg-primary-subtle'
                      : 'border-border bg-card hover:border-border-strong',
                  )}
                >
                  <span className="text-sm font-semibold text-foreground">
                    {TEMPLATES[t].label}
                  </span>
                  <span className="text-[13px] text-muted-foreground">{TEMPLATES[t].hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-label">Value</span>
              <div
                className="flex gap-0.5 rounded-lg bg-[#eceef3] p-[3px] dark:bg-muted"
                role="group"
                aria-label="Value type"
              >
                {kindButton('kv', 'Key / value')}
                {kindButton('json', 'JSON')}
                {kindButton('text', 'Plain text')}
              </div>
            </div>
            <div className={cn(kind !== 'kv' && 'hidden')}>
              <KvEditor
                variant="form"
                rows={rows}
                onChange={setRows}
                masked={isMaskedKey}
                placeholderFor={(k) => placeholderFor(template, k)}
              />
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
          {showTags && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-label">
                Tags <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <TagRowsEditor rows={tags} onChange={setTags} />
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2.5 border-t pt-4">
            {!showTags && (
              <Button
                type="button"
                variant="text"
                className="px-1"
                onClick={() => {
                  setShowTags(true)
                  setTags([newRow()])
                }}
              >
                <PlusIcon />
                Add tags
              </Button>
            )}
            <div className="flex-1" />
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="success" disabled={pending}>
              {pending ? 'Creating…' : 'Create secret'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
