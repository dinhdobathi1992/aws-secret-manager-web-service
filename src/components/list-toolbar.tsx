'use client'

import { PlusIcon, SearchIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type TagOption = { k: string; v: string }

/** Toolbar at the top of the secrets card: search (`/`), active tag filter, tag picker, clear. */
export function ListToolbar({ tagOptions }: { tagOptions: TagOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState(params.get('q') ?? '')
  const activeKey = params.get('tk')
  const active: TagOption | null = activeKey ? { k: activeKey, v: params.get('tv') ?? '' } : null

  const hrefWith = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    next.delete('cursor') // any filter change restarts pagination
    const s = next.toString()
    return s ? `${pathname}?${s}` : pathname
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      const modified = e.metaKey || e.ctrlKey || e.altKey
      const dialogOpen = !!document.querySelector('[role="dialog"],[role="alertdialog"]')
      if (e.key === '/' && !typing && !modified && !dialogOpen) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Debounced server-side search (ListSecrets name filter). The timer lives in the input handler,
  // not an effect, so Clear can cancel it and a pending search can't restore cleared filters.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const onSearch = (value: string) => {
    setQ(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => router.replace(hrefWith({ q: value.trim() || null })), 300)
  }

  // Follow the URL when it changes elsewhere (Clear, back/forward), without undoing typing.
  const urlQ = params.get('q') ?? ''
  const [seenUrlQ, setSeenUrlQ] = useState(urlQ)
  if (urlQ !== seenUrlQ) {
    setSeenUrlQ(urlQ)
    if (q.trim() !== urlQ) setQ(urlQ)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
      <label className="flex h-[34px] w-[360px] items-center gap-2 rounded-lg border bg-background pr-2 pl-2.5 text-muted-foreground focus-within:ring-2 focus-within:ring-ring/50">
        <SearchIcon className="size-[15px] shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Search secrets by name"
          placeholder="Search by name prefix"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border px-[5px] font-mono text-[11px]">
          /
        </kbd>
      </label>
      <span className="mx-1 h-5 w-px bg-border" />
      {active && (
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary pr-1 pl-2.5 font-mono text-xs text-primary-foreground">
          <span className="opacity-65">{active.k}</span>
          {active.v && <span className="font-semibold">{active.v}</span>}
          <Link
            href={hrefWith({ tk: null, tv: null })}
            aria-label={`Remove filter ${active.k}: ${active.v}`}
            className="inline-flex size-5 items-center justify-center rounded-full bg-primary-foreground/80 text-primary"
          >
            <XIcon className="size-3" />
          </Link>
        </span>
      )}
      <TagFilterPopover
        options={tagOptions}
        onApply={(k, v) => router.push(hrefWith({ tk: k, tv: v || null }))}
      />
      {(active || params.get('q')) && (
        <Button asChild variant="ghost" size="sm" className="h-7 text-muted-foreground">
          <Link
            href={hrefWith({ q: null, tk: null, tv: null })}
            onClick={() => {
              clearTimeout(timer.current)
              setQ('')
            }}
          >
            Clear
          </Link>
        </Button>
      )}
    </div>
  )
}

function TagFilterPopover({
  options,
  onApply,
}: {
  options: TagOption[]
  onApply: (key: string, value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const apply = (k: string, v: string) => {
    onApply(k, v)
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 border-dashed bg-transparent text-muted-foreground"
        >
          <PlusIcon />
          Tag filter
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        {options.length > 0 && (
          <div className="mb-3 flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[.06em] text-muted-foreground uppercase">
              Tags in view
            </span>
            <div className="flex flex-wrap gap-1.5">
              {options.map((t) => (
                <button
                  key={`${t.k}=${t.v}`}
                  type="button"
                  onClick={() => apply(t.k, t.v)}
                  className="inline-flex h-6 items-center gap-1 rounded-md bg-muted px-2 font-mono text-xs hover:bg-muted/70"
                >
                  <span className="opacity-70">{t.k}</span>
                  <span className="font-semibold">{t.v}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (key.trim()) apply(key.trim(), value)
          }}
        >
          <Input
            aria-label="Tag key"
            placeholder="key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <Input
            aria-label="Tag value"
            placeholder="value (optional)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button type="submit" size="sm">
            Apply
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
