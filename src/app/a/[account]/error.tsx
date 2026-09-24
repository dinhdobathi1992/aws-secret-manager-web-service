'use client'

import { Button } from '@/components/ui/button'

/** Last-resort boundary. Shows the digest only: production error messages never reach clients. */
export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      role="alert"
      className="flex max-w-xl flex-col items-start gap-3 rounded-xl border bg-card p-8"
    >
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">
        Try again. If it keeps happening, share this reference with an admin:{' '}
        <span className="font-mono">{error.digest ?? 'n/a'}</span>
      </p>
      <Button size="sm" variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
