'use client'

/** Root boundary (e.g. layout failures). Production errors carry only a digest, never a message. */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div
        role="alert"
        className="flex max-w-md flex-col items-start gap-3 rounded-xl border bg-card p-8"
      >
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          Try again. If it keeps happening, share this reference with an admin:{' '}
          <span className="font-mono">{error.digest ?? 'n/a'}</span>
        </p>
        <button type="button" onClick={reset} className="text-sm font-medium underline">
          Try again
        </button>
      </div>
    </main>
  )
}
