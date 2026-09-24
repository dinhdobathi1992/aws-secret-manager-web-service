import { SearchIcon } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-start gap-3 rounded-xl border bg-card p-8">
        <SearchIcon className="size-7 text-muted-foreground" />
        <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[11px] font-semibold">
          404
        </span>
        <h1 className="text-xl font-semibold">Not found</h1>
        <p className="text-sm text-muted-foreground">
          The secret or account doesn’t exist, or you don’t have access to it.
        </p>
        <Link href="/" className="text-sm font-medium underline">
          Back to secrets
        </Link>
      </div>
    </div>
  )
}
