'use client'

import { useEffect } from 'react'

export const AUTO_HIDE_MS = 30_000

/**
 * While `active`, calls `hide` after 30s and as soon as the page becomes hidden. Used for every
 * place a secret value is on screen.
 */
export function useAutoHide(active: boolean, hide: () => void) {
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(hide, AUTO_HIDE_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hide()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [active, hide])
}
