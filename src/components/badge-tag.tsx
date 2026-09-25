import { cn } from '@/lib/utils'

export type Tone = 'neutral' | 'green' | 'blue' | 'amber' | 'red' | 'violet' | 'teal'

const TONE: Record<Tone, string> = {
  neutral: 'bg-zinc-200 text-zinc-700 dark:bg-neutral-800 dark:text-neutral-300',
  green: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
}

/** Small rectangular status tag (AWSCURRENT, RECENT, ADMIN, CHANGED, NEW …). */
export function BadgeTag({
  tone = 'neutral',
  mono,
  children,
  className,
}: {
  tone?: Tone
  mono?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-[5px] px-[7px] text-[11px] font-semibold tracking-[.03em] uppercase',
        mono && 'font-mono',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
