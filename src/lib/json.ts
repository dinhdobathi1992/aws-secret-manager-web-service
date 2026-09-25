export type JsonParseResult = { ok: true; value: unknown } | { ok: false }

/**
 * The only JSON.parse allowed on secret data. Node's SyntaxError message quotes the input text,
 * so the native error must never surface; this returns a bare failure instead.
 */
export function safeParseJson(text: string): JsonParseResult {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false }
  }
}

/** A flat object of string values, i.e. what the key/value editor can show. */
export function asKeyValue(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const entries = Object.entries(value as Record<string, unknown>)
  if (!entries.every(([, v]) => typeof v === 'string')) return null
  return Object.fromEntries(entries) as Record<string, string>
}
