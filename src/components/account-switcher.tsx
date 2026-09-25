'use client'

import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { AccountOption } from '@/lib/data/page-data'
import { RoleBadge } from './role-badge'

export function AccountSwitcher({
  accounts,
  currentId,
}: {
  accounts: AccountOption[]
  currentId: string
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const current = accounts.find((a) => a.id === currentId)
  if (!current) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label="Switch account"
          className="h-8 gap-2 bg-transparent pr-2 pl-2.5 text-[13px]"
        >
          <span className="font-medium">{current.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{current.shortId}</span>
          <RoleBadge role={current.role} />
          <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Find account" />
          <CommandList>
            <CommandEmpty>No account found.</CommandEmpty>
            <CommandGroup>
              {accounts.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`${a.name} ${a.id}`}
                  onSelect={() => {
                    setOpen(false)
                    router.push(`/a/${encodeURIComponent(a.id)}`)
                  }}
                  className="gap-2.5 py-2"
                >
                  <CheckIcon className={a.id === currentId ? 'opacity-100' : 'opacity-0'} />
                  <span className="font-medium">{a.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{a.shortId}</span>
                  <span className="flex-1" />
                  <RoleBadge role={a.role} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            Only accounts where you have a role are listed.
          </p>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
