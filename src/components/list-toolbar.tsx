'use client'

import { PlusIcon, SearchIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** Search box (`/` focuses it) and tag filter chips. State lives in the URL. */
type TagOption = { k: string; v: string }

export function ListToolbar({ tagOptions }: { tagOptions: TagOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState(params.get('q') ?? '')
  const activeKey = params.get('tk')
  const active: TagOption | null = activeKey ? { k: activeKey, v: params.get('tv') ?? '' } : null
  const same = (a: TagOption, b: TagOption | null) => !!b && a.k === b.k && a.v === b.v

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

  // Debounced server-side search (ListSecrets name filter).
  useEffect(() => {
    if ((params.get('q') ?? '') === q) return
    const t = setTimeout(() => router.replace(hrefWith({ q: q.trim() || null })), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [q])

  const chips = [...(active ? [active] : []), ...tagOptions.filter((t) => !same(t, active))].slice(
    0,
    6,
  )
  const label = (t: TagOption) => (t.v ? `${t.k}:${t.v}` : t.k)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="relative flex w-[420px] items-center">
        <SearchIcon className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search secrets by name"
          placeholder="Search by name prefix"
          className="h-9 bg-card pr-10 pl-9"
        />
        <kbd className="pointer-events-none absolute right-2.5 inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-mono text-[11px] text-muted-foreground">
          /
        </kbd>
      </label>
      {chips.length > 0 && <span className="text-[13px] text-muted-foreground">Tags</span>}
      {chips.map((t) =>
        same(t, active) ? (
          <Button key={label(t)} size="sm" asChild>
            <Link
              href={hrefWith({ tk: null, tv: null })}
              aria-label={`Remove tag filter ${label(t)}`}
            >
              <span className="font-mono">{label(t)}</span>
              <XIcon />
            </Link>
          </Button>
        ) : (
          <Button key={label(t)} size="sm" variant="outline" asChild>
            <Link href={hrefWith({ tk: t.k, tv: t.v || null })} className="font-mono">
              {label(t)}
            </Link>
          </Button>
        ),
      )}
      <TagFilterPopover onApply={(k, v) => router.push(hrefWith({ tk: k, tv: v || null }))} />
    </div>
  )
}

function TagFilterPopover({ onApply }: { onApply: (key: string, value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost">
          <PlusIcon />
          Tag filter
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!key.trim()) return
            onApply(key.trim(), value)
            setOpen(false)
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
