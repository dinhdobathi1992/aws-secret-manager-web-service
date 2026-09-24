import type { KeyDiff } from '@/lib/ui/key-diff'

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
