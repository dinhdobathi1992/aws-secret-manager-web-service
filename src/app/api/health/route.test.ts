import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

let configOk = true
vi.mock('@/lib/config', async (orig) => {
  const real = await orig<typeof import('@/lib/config')>()
  return {
    ...real,
    getConfig: () => {
      if (!configOk) throw new real.ConfigError('Invalid configuration:\n  ACCOUNTS: required')
      return {}
    },
  }
})

const { GET } = await import('./route')
const req = (q = '') => new NextRequest(`http://localhost:3000/api/health${q}`)

describe('/api/health', () => {
  it('liveness is 200 and uncached, even with broken config', async () => {
    configOk = false
    const res = GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('readiness requires valid config', async () => {
    configOk = false
    expect(GET(req('?ready')).status).toBe(503)
    configOk = true
    expect(GET(req('?ready')).status).toBe(200)
  })
})
