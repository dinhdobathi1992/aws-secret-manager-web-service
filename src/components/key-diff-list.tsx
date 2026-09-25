import type { KeyDiff } from '@/lib/ui/key-diff'
import { BadgeTag } from './badge-tag'

const ROWS = [
  {
    key: 'added',
    sign: '+',
    label: 'added',
    cls: 'bg-green-50 text-green-800 dark:bg-green-950/50 dark:text-green-300',
  },
  {
    key: 'changed',
    sign: '~',
    label: 'changed',
    cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  },
  {
    key: 'removed',
    sign: '−',
    label: 'removed',
    cls: 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300',
  },
] as const

/** Key names only, grouped by change. Values are never passed in. */
export function KeyDiffList({ diff, showSame }: { diff: KeyDiff; showSame?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      {ROWS.flatMap((r) =>
        diff[r.key].map((k) => (
          <div
            key={`${r.key}:${k}`}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 ${r.cls}`}
          >
            <span className="w-4 font-mono font-bold">{r.sign}</span>
            <span className="font-mono font-medium text-foreground">{k}</span>
            <span className="flex-1" />
            <span className="text-xs font-semibold">{r.label}</span>
          </div>
        )),
      )}
      {showSame &&
        diff.same.map((k) => (
          <div
            key={`same:${k}`}
            className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2 text-muted-foreground"
          >
            <span className="w-4 font-mono font-bold">=</span>
            <span className="font-mono">{k}</span>
          </div>
        ))}
    </div>
  )
}

const GROUPS = [
  { key: 'changed', label: 'changed', tone: 'amber' },
  { key: 'added', label: 'added', tone: 'green' },
  { key: 'removed', label: 'removed', tone: 'red' },
] as const

/** Save-confirmation box: each non-empty change group with its key names, empties summarised. */
export function SaveSummary({ diff }: { diff: KeyDiff }) {
  const present = GROUPS.filter((g) => diff[g.key].length)
  const empty = GROUPS.filter((g) => !diff[g.key].length)
  return (
    <div className="overflow-hidden rounded-[10px] border">
      {present.map((g, i) => (
        <div key={g.key} className={i > 0 ? 'border-t' : undefined}>
          <div className="flex items-center gap-2 border-b bg-sunken px-3 py-2.5">
            <BadgeTag tone={g.tone}>{g.label}</BadgeTag>
            <span className="text-xs text-muted-foreground">
              {diff[g.key].length} {diff[g.key].length === 1 ? 'key' : 'keys'}
            </span>
          </div>
          <div className="flex flex-col gap-1 px-3 py-2.5 font-mono text-[13px]">
            {diff[g.key].map((k) => (
              <span key={k}>{k}</span>
            ))}
          </div>
        </div>
      ))}
      {empty.length > 0 && (
        <div className="flex items-center gap-4 border-t px-3 py-2.5 text-xs text-muted-foreground">
          {empty.map((g) => (
            <span key={g.key}>{g.label[0].toUpperCase() + g.label.slice(1)}: none</span>
          ))}
        </div>
      )}
    </div>
  )
}
