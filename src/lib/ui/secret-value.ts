import { asKeyValue, safeParseJson } from '@/lib/json'

/**
 * How a revealed value is edited:
 * - kv: a flat JSON object of strings (key/value editor)
 * - json: any other valid JSON (raw editor, validated on save)
 * - text: not JSON (raw editor)
 * - binary: base64, read-only
 */
export type ValueModel =
  | { kind: 'kv'; entries: Record<string, string> }
  | { kind: 'json'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'binary'; base64: string }

export function toModel(value: string, kind: 'string' | 'binary'): ValueModel {
  if (kind === 'binary') return { kind: 'binary', base64: value }
  const parsed = safeParseJson(value)
  if (!parsed.ok) return { kind: 'text', text: value }
  const kv = asKeyValue(parsed.value)
  return kv ? { kind: 'kv', entries: kv } : { kind: 'json', text: value }
}

/** The entries used for a key-level diff; non key/value secrets diff as a single "(value)" key. */
export function diffEntries(model: ValueModel): Record<string, string> {
  switch (model.kind) {
    case 'kv':
      return model.entries
    case 'binary':
      return { '(value)': model.base64 }
    default:
      return { '(value)': model.text }
  }
}

export function serialize(model: ValueModel): string {
  switch (model.kind) {
    case 'kv':
      return JSON.stringify(model.entries)
    case 'binary':
      return model.base64
    default:
      return model.text
  }
}

export function isValidJson(text: string): boolean {
  return safeParseJson(text).ok
}
