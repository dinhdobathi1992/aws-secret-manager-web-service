import { toast } from 'sonner'

const CLIPBOARD_CLEAR_MS = 30_000

/** Best-effort: overwrite the clipboard later. Depends on browser permission; not a control. */
export async function copyWithClear(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success('Copied. The clipboard is cleared in 30s where the browser allows it.')
    setTimeout(() => {
      navigator.clipboard.writeText('').catch(() => {})
    }, CLIPBOARD_CLEAR_MS)
  } catch {
    toast.error('Clipboard access was blocked by the browser.')
  }
}
