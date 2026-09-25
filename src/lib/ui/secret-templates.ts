/**
 * Create-dialog templates. They fill in key names and example placeholders only, never a value.
 * Keys follow the shapes AWS rotation functions expect for each database type.
 */
export type TemplateId = 'rds' | 'docdb' | 'redshift' | 'other'

export const TEMPLATES: Record<
  TemplateId,
  { label: string; hint: string; keys: readonly (readonly [key: string, example: string])[] }
> = {
  rds: {
    label: 'RDS database',
    hint: 'Amazon RDS credentials',
    keys: [
      ['username', 'admin'],
      ['password', 'Enter password'],
      ['engine', 'mysql'],
      ['host', 'your-db-host'],
      ['port', '3306'],
      ['dbname', 'your-database'],
    ],
  },
  docdb: {
    label: 'DocumentDB',
    hint: 'DocumentDB credentials',
    keys: [
      ['username', 'admin'],
      ['password', 'Enter password'],
      ['engine', 'mongo'],
      ['host', 'your-cluster-host'],
      ['port', '27017'],
      ['ssl', 'true'],
    ],
  },
  redshift: {
    label: 'Redshift',
    hint: 'Redshift credentials',
    keys: [
      ['username', 'admin'],
      ['password', 'Enter password'],
      ['engine', 'redshift'],
      ['host', 'your-cluster-host'],
      ['port', '5439'],
      ['dbname', 'dev'],
    ],
  },
  other: { label: 'Other', hint: 'API key, token, anything', keys: [['', '']] },
}

/** Template keys that hold no secret; every other value is masked while typing. */
const PLAIN_KEYS = new Set(['username', 'engine', 'host', 'port', 'dbname', 'ssl'])

export function isMaskedKey(key: string): boolean {
  return !PLAIN_KEYS.has(key.trim().toLowerCase())
}

/** Example text for a key's value input, from the chosen template. */
export function placeholderFor(template: TemplateId, key: string): string | undefined {
  return TEMPLATES[template].keys.find(([k]) => k === key)?.[1] || undefined
}

/**
 * Rows for a newly chosen template: its keys, keeping any value already typed under the same key,
 * then any extra rows the user added that the template doesn't name.
 */
export function applyTemplate(
  template: TemplateId,
  current: { key: string; value: string }[],
): { key: string; value: string }[] {
  const typed = new Map(current.filter((r) => r.key.trim()).map((r) => [r.key, r.value]))
  const keys = TEMPLATES[template].keys.map(([k]) => k)
  const rows = keys.map((k) => ({ key: k, value: (k && typed.get(k)) || '' }))
  const extra = current.filter((r) => r.key.trim() && !keys.includes(r.key) && r.value)
  return [...rows.filter((r) => r.key || !extra.length), ...extra]
}
