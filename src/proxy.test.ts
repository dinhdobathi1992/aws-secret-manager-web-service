import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { buildCsp, proxy } from './proxy'

describe('proxy', () => {
  it('redirects to /login with returnTo when there is no session cookie', () => {
    const res = proxy(new NextRequest('http://localhost:3000/a/dev?q=x'))
    expect(res.status).toBe(307)
    const loc = new URL(res.headers.get('location')!)
    expect(loc.pathname).toBe('/login')
    expect(loc.searchParams.get('returnTo')).toBe('/a/dev?q=x')
  })

  it('passes through with a fresh nonce CSP when a session cookie exists', () => {
    const req = (cookie: string) =>
      new NextRequest('http://localhost:3000/a/dev', { headers: { cookie: `${cookie}=x` } })
    for (const name of ['sc_session', '__Host-sc_session']) {
      const res = proxy(req(name))
      expect(res.headers.get('location')).toBeNull()
      expect(res.headers.get('content-security-policy')).toMatch(/script-src 'self' 'nonce-/)
    }
    const a = proxy(req('sc_session')).headers.get('content-security-policy')
    const b = proxy(req('sc_session')).headers.get('content-security-policy')
    expect(a).not.toBe(b)
  })

  it('CSP forbids framing and plugins, and only allows eval in dev', () => {
    const prod = buildCsp('n', false)
    expect(prod).toContain(`frame-ancestors 'none'`)
    expect(prod).toContain(`object-src 'none'`)
    expect(prod).not.toContain('unsafe-eval')
    expect(buildCsp('n', true)).toContain('unsafe-eval')
  })
})
