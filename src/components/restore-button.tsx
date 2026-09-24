'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { restoreSecret } from '@/lib/actions/secrets'

export function RestoreButton({ accountId, name }: { accountId: string; name: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await restoreSecret({ accountId, name })
          if (!res.ok) return void toast.error(res.message)
          toast.success(`Restored ${name}`)
          router.refresh()
        })
      }
    >
      {pending ? 'Restoring…' : 'Restore'}
    </Button>
  )
}
