'use client'

import { LayoutGridIcon, Rows3Icon } from 'lucide-react'
import { createContext, useContext, useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'

type Layout = 'cards' | 'table'
const KEY = 'secrets-console.list-layout'
const Ctx = createContext<{ layout: Layout; setLayout: (l: Layout) => void }>({
  layout: 'cards',
  setLayout: () => {},
})

const listeners = new Set<() => void>()
let memory: Layout = 'cards' // used when storage is blocked

function read(): Layout {
  try {
    return localStorage.getItem(KEY) === 'table' ? 'table' : 'cards'
  } catch {
    return memory
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

/** Cards / Table choice for the secrets list. Kept in this browser only; storage may be blocked. */
export function ListLayoutProvider({ children }: { children: React.ReactNode }) {
  const layout = useSyncExternalStore(subscribe, read, () => 'cards' as Layout)
  const setLayout = (l: Layout) => {
    memory = l
    try {
      localStorage.setItem(KEY, l)
    } catch {
      // Not remembered across reloads, still switched.
    }
    listeners.forEach((cb) => cb())
  }
  return <Ctx.Provider value={{ layout, setLayout }}>{children}</Ctx.Provider>
}

export function LayoutSwitch() {
  const { layout, setLayout } = useContext(Ctx)
  const item = (l: Layout, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      aria-pressed={layout === l}
      onClick={() => setLayout(l)}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium',
        layout === l
          ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,.08)]'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  )
  return (
    <div
      role="group"
      aria-label="Layout"
      className="flex gap-0.5 rounded-lg bg-[#eceef3] p-[3px] dark:bg-muted"
    >
      {item('cards', 'Cards', <LayoutGridIcon className="size-4" />)}
      {item('table', 'Table', <Rows3Icon className="size-4" />)}
    </div>
  )
}

/** Renders whichever layout is chosen. Both are server-rendered; only one is mounted. */
export function LayoutView({ cards, table }: { cards: React.ReactNode; table: React.ReactNode }) {
  const { layout } = useContext(Ctx)
  return <>{layout === 'table' ? table : cards}</>
}
