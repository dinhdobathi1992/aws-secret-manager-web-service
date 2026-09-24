'use client'

import { ChevronDownIcon, LogOutIcon } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  )
}

export function UserMenu({ name, upn }: { name: string; upn: string }) {
  // The form lives outside the menu: Radix unmounts menu content on select, which would detach
  // an inner form before it submits.
  const formRef = useRef<HTMLFormElement>(null)
  return (
    <>
      <form ref={formRef} action="/api/auth/logout" method="post" className="hidden" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" aria-label="User menu" className="h-9 gap-2 px-2">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
              {initials(name)}
            </span>
            <span className="max-w-40 truncate text-sm">{name}</span>
            <ChevronDownIcon className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate">{name}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{upn}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* POST, same-origin only (see /api/auth/logout). */}
          <DropdownMenuItem onSelect={() => formRef.current?.requestSubmit()}>
            <LogOutIcon />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
