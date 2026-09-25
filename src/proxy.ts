import { NextResponse, type NextRequest } from 'next/server'
import { SECURE_SESSION_COOKIE, SESSION_COOKIE } from '@/lib/auth/cookie-names'

/** Origin of APP_LOGO_URL when it is an https URL, so the CSP allows that one image host. */
function logoOrigin(): string {
  const logo = process.env.APP_LOGO_URL
  if (!logo?.startsWith('https://')) return ''
  try {
    return ` ${new URL(logo).origin}`
  } catch {
    return ''
  }
}

export function buildCsp(nonce: string, isDev: boolean): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? ` 'unsafe-eval'` : ''}`,
    // Radix/sonner set inline style attributes, which a nonce can't cover.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:${logoOrigin()}`,
    `font-src 'self'`,
    `connect-src 'self'${isDev ? ' ws:' : ''}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self' https://login.microsoftonline.com`,
    `frame-ancestors 'none'`,
  ].join('; ')
}

/**
 * Sets a per-request CSP nonce and sends visitors without a session cookie to /login.
 * This redirect is a convenience, NOT an authorization boundary: every page and action
 * re-checks the session and role on the server.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'development')
  const { pathname, search } = request.nextUrl

  const hasSession =
    request.cookies.has(SESSION_COOKIE) || request.cookies.has(SECURE_SESSION_COOKIE)
  if (!hasSession && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = `?returnTo=${encodeURIComponent(`${pathname}${search}`)}`
    const res = NextResponse.redirect(url)
    res.headers.set('Content-Security-Policy', csp)
    return res
  }

  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  // For login redirects from server components (always overwritten; sanitized by safeReturnTo).
  headers.set('x-pathname', `${pathname}${search}`)
  headers.set('Content-Security-Policy', csp)
  const res = NextResponse.next({ request: { headers } })
  res.headers.set('Content-Security-Policy', csp)
  return res
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
