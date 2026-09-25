import { safeParseJson } from '@/lib/json'

/**
 * One-time "Edit secret" intent, so the detail page auto-views only after a click in this tab.
 * A crafted `?edit=1` link, a refresh or Back finds no intent and shows the hidden state. Storage
 * may be blocked; then there is simply no auto-view.
 */
const KEY = 'secrets-console.edit-intent'
const TTL_MS = 60_000

export function markEditIntent(accountId: string, name: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ accountId, name, at: Date.now() }))
  } catch {
    // No auto-view; the user presses View secret on the detail page.
  }
}

/** True once, for the secret the intent was set for, within a minute. Always clears it. */
export function takeEditIntent(accountId: string, name: string): boolean {
  try {
    const raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    if (!raw) return false
    const parsed = safeParseJson(raw)
    if (!parsed.ok || typeof parsed.value !== 'object' || parsed.value === null) return false
    const v = parsed.value as Record<string, unknown>
    return (
      v.accountId === accountId &&
      v.name === name &&
      typeof v.at === 'number' &&
      Date.now() - v.at < TTL_MS
    )
  } catch {
    return false
  }
}
