'use client'

import { CheckIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

/** Copies non-secret text (names, ids). Secret values use the value panel's own copy. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      className="text-muted-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          // Clipboard permission denied: nothing to do.
        }
      }}
    >
      {done ? <CheckIcon /> : <CopyIcon />}
    </Button>
  )
}
