'use client'

import { CheckIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Copies non-secret text (names, ids, ARNs). Secret values use the value panel's own copy.
 * With `children`, renders a labelled secondary button; otherwise an icon button.
 */
export function CopyButton({
  text,
  label,
  children,
}: {
  text: string
  label: string
  children?: React.ReactNode
}) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    } catch {
      // Clipboard permission denied: nothing to do.
    }
  }
  const icon = done ? <CheckIcon /> : <CopyIcon />
  if (children) {
    return (
      <Button variant="secondary" aria-label={label} onClick={copy}>
        {icon}
        {children}
      </Button>
    )
  }
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      className="text-muted-foreground"
      onClick={copy}
    >
      {icon}
    </Button>
  )
}
