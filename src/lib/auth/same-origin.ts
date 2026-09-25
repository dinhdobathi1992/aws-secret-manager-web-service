import { getConfig } from '@/lib/config'

/**
 * CSRF guard for state-changing route handlers (logout, dev login). Unlike server actions,
 * route handlers get no built-in Origin check, and a cross-site auto-submitting form is a
 * top-level navigation that SameSite=Lax does not stop.
 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site) return site === 'same-origin'
  const origin = request.headers.get('origin')
  return !!origin && origin === new URL(getConfig().APP_URL).origin
}
