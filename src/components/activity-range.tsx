'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ACTIVITY_RANGES } from '@/lib/ui/activity-options'

/** Time range picker. A new range starts again from the newest events. */
export function ActivityRange() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const range = ACTIVITY_RANGES.find((r) => r.id === params.get('range'))?.id ?? '7d'
  return (
    <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
      Range
      <select
        value={range}
        onChange={(e) => {
          const next = new URLSearchParams(params)
          if (e.target.value === '7d') next.delete('range')
          else next.set('range', e.target.value)
          next.delete('cursor')
          next.delete('end')
          const s = next.toString()
          router.push(s ? `${pathname}?${s}` : pathname)
        }}
        className="h-[38px] rounded-lg border bg-card px-2.5 text-sm text-foreground"
      >
        {ACTIVITY_RANGES.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
    </label>
  )
}
