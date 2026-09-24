/** Pure editor models shared by the key/value and tag editors (unit-tested). */

export type KvRow = { id: string; key: string; value: string }
export type TagRow = KvRow

let seq = 0
export const newRow = (key = '', value = ''): KvRow => ({ id: `r${++seq}`, key, value })

export function rowsFrom(entries: Record<string, string>): KvRow[] {
  return Object.entries(entries).map(([k, v]) => newRow(k, v))
}

/**
 * Rows → entries, keeping keys exactly as typed (no trimming, so existing keys round-trip) and
 * using a null-prototype object so keys like "__proto__" survive. Blank or duplicate keys error.
 */
export function entriesFrom(
  rows: KvRow[],
): { ok: true; entries: Record<string, string> } | { ok: false; error: string } {
  const entries: Record<string, string> = Object.create(null)
  for (const r of rows) {
    if (!r.key.trim()) return { ok: false, error: 'Every row needs a key.' }
    if (Object.hasOwn(entries, r.key)) return { ok: false, error: `Duplicate key "${r.key}".` }
    entries[r.key] = r.value
  }
  return { ok: true, entries }
}

/** Diff edited tag rows against the original tags into the {set, remove} shape updateTags expects. */
export function tagChanges(
  original: Record<string, string>,
  rows: TagRow[],
): { ok: true; set: Record<string, string>; remove: string[] } | { ok: false; error: string } {
  const next: Record<string, string> = Object.create(null)
  for (const r of rows) {
    if (!r.key.trim()) return { ok: false, error: 'Every tag needs a key.' }
    if (r.key.toLowerCase().startsWith('aws:')) {
      return { ok: false, error: 'Keys starting with aws: are reserved.' }
    }
    if (Object.hasOwn(next, r.key)) return { ok: false, error: `Duplicate tag "${r.key}".` }
    next[r.key] = r.value
  }
  const set: Record<string, string> = Object.create(null)
  for (const [k, v] of Object.entries(next)) {
    if (!Object.hasOwn(original, k) || original[k] !== v) set[k] = v
  }
  const remove = Object.keys(original).filter((k) => !Object.hasOwn(next, k))
  return { ok: true, set: { ...set }, remove }
}
