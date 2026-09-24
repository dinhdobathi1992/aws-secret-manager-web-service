import { describe, expect, it } from 'vitest'
import nextConfig from '../next.config'

describe('next.config', () => {
  it('never logs server action arguments (they carry secret values)', () => {
    expect(nextConfig.logging && nextConfig.logging.serverFunctions).toBe(false)
  })

  it('has no env-derived values baked into the standalone build', () => {
    expect(JSON.stringify(nextConfig)).not.toMatch(/localhost|https?:\/\//)
    expect(nextConfig.experimental?.serverActions?.allowedOrigins).toBeUndefined()
  })
})
