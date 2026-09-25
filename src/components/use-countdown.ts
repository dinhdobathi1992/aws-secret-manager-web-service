'use client'

import { useEffect, useState } from 'react'
import { AUTO_HIDE_MS } from './use-auto-hide'

/**
 * Seconds left of the auto-hide window, for the visible countdown. Display only: the hide itself
 * is `useAutoHide`. Restarts whenever `key` changes (a new view).
 */
export function useCountdown(active: boolean, key: unknown): number {
  const total = AUTO_HIDE_MS / 1000
  const [left, setLeft] = useState(total)
  useEffect(() => {
    if (!active) return
    const start = Date.now()
    const tick = () => setLeft(Math.max(0, total - Math.floor((Date.now() - start) / 1000)))
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, 250)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [active, key, total])
  return active ? left : total
}
