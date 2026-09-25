import { LockIcon } from 'lucide-react'
import Link from 'next/link'

export default function Forbidden() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-start gap-3 surface p-8">
        <LockIcon className="size-7 text-muted-foreground" />
        <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[11px] font-semibold">
          403
        </span>
        <h1 className="text-xl font-semibold">Your role doesn’t allow this</h1>
        <p className="text-sm text-muted-foreground">
          Ask an account admin if you need more access.
        </p>
        <Link href="/" className="text-sm font-medium underline">
          Back to secrets
        </Link>
      </div>
    </div>
  )
}
