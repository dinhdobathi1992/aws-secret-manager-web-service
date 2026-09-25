export type KeyDiff = { added: string[]; removed: string[]; changed: string[]; same: string[] }

/** Compares two key/value maps and reports key names only. Values never leave this function. */
export function keyDiff(before: Record<string, string>, after: Record<string, string>): KeyDiff {
  const diff: KeyDiff = { added: [], removed: [], changed: [], same: [] }
  for (const k of Object.keys(after)) {
    if (!Object.hasOwn(before, k)) diff.added.push(k)
    else if (before[k] !== after[k]) diff.changed.push(k)
    else diff.same.push(k)
  }
  for (const k of Object.keys(before)) if (!Object.hasOwn(after, k)) diff.removed.push(k)
  for (const list of Object.values(diff)) list.sort()
  return diff
}

export function hasChanges(d: KeyDiff): boolean {
  return d.added.length + d.removed.length + d.changed.length > 0
}
