'use client'

import { Trash2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteSecret } from '@/lib/actions/secrets'
import { RoleBadge } from './role-badge'

export function DangerPanel({ accountId, name }: { accountId: string; name: string }) {
  const router = useRouter()
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const remove = () =>
    startTransition(async () => {
      const res = await deleteSecret({ accountId, name })
      if (!res.ok) return setError(res.message)
      toast.success(`${name} is scheduled for deletion in 30 days.`)
      router.push(`/a/${encodeURIComponent(accountId)}/deleted`)
    })

  return (
    <div className="flex max-w-3xl flex-col gap-4 rounded-xl border border-red-200 bg-card p-6 dark:border-red-900">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">Delete this secret</h2>
        <RoleBadge role="admin" />
      </div>
      <p className="text-sm text-muted-foreground">
        The secret is scheduled for deletion with a 30-day recovery window. Until then it can be
        restored from Scheduled deletion. Apps reading it start failing immediately.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-name">
          Type <span className="font-mono font-semibold">{name}</span> to confirm
        </Label>
        <Input
          id="confirm-name"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="max-w-md font-mono"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div>
        <Button
          className="bg-red-700 text-white hover:bg-red-800"
          disabled={typed !== name || pending}
          onClick={remove}
        >
          <Trash2Icon />
          {pending ? 'Scheduling…' : 'Schedule deletion'}
        </Button>
      </div>
    </div>
  )
}
