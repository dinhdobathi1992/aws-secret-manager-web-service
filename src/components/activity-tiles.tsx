'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export type TileSpec = {
  id: string
  label: string
  value: string
  sub: string
  href: string
  on: boolean
  icon?: React.ReactNode
}

/** The Activity filters: toggle buttons (`aria-pressed`) that load the chosen view. */
export function ActivityTiles({ tiles }: { tiles: TileSpec[] }) {
  const router = useRouter()
  return (
    <div role="group" aria-label="Show" className="grid grid-cols-2 gap-4 md:grid-cols-5">
      {tiles.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={t.on}
          onClick={() => router.push(t.href)}
          className={cn(
            'flex flex-col items-stretch gap-2 rounded-[10px] border-2 px-[18px] py-4 text-left shadow-card transition-colors',
            t.on
              ? 'border-primary bg-primary-subtle'
              : 'border-transparent bg-card hover:border-border-strong dark:border-border',
          )}
        >
          <span className="flex min-h-[30px] items-center justify-between gap-2">
            <span
              className={cn('text-sm font-medium', t.on ? 'text-primary' : 'text-muted-foreground')}
            >
              {t.label}
            </span>
            {t.icon}
          </span>
          <span className="text-[28px] leading-none font-semibold text-foreground">{t.value}</span>
          <span className="text-[13px] text-muted-foreground">{t.sub}</span>
        </button>
      ))}
    </div>
  )
}
