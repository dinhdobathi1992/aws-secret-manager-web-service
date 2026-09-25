import { describe, expect, it } from 'vitest'
import { loginCookieName, safeReturnTo, sealLoginState, unsealLoginState } from './login-state'

const PASSWORD = 'p'.repeat(48)
const attempt = (state: string) => ({
  state,
  nonce: `n-${state}`,
  codeVerifier: `v-${state}`,
  returnTo: '/a/dev',
})

describe('login state', () => {
  it('two concurrent attempts use separate cookies and both complete', async () => {
    const a = attempt('AAAAstateOne_xyz')
    const b = attempt('BBBBstateTwo-xyz')
    expect(loginCookieName(a.state)).not.toBe(loginCookieName(b.state))
    const jar = new Map<string, string>()
    jar.set(loginCookieName(a.state), await sealLoginState(a, PASSWORD))
    jar.set(loginCookieName(b.state), await sealLoginState(b, PASSWORD))
    // Callbacks arrive in the opposite order.
    const gotB = await unsealLoginState(jar.get(loginCookieName(b.state)), b.state, PASSWORD)
    const gotA = await unsealLoginState(jar.get(loginCookieName(a.state)), a.state, PASSWORD)
    expect(gotA?.nonce).toBe(a.nonce)
    expect(gotB?.nonce).toBe(b.nonce)
  })

  it('rejects a state that does not match the sealed attempt', async () => {
    const sealed = await sealLoginState(attempt('one'), PASSWORD)
    expect(await unsealLoginState(sealed, 'two', PASSWORD)).toBeNull()
    expect(await unsealLoginState(undefined, 'one', PASSWORD)).toBeNull()
    const mid = Math.floor(sealed.length / 2)
    const tampered =
      sealed.slice(0, mid) + (sealed[mid] === 'A' ? 'B' : 'A') + sealed.slice(mid + 1)
    expect(await unsealLoginState(tampered, 'one', PASSWORD)).toBeNull()
  })
})

describe('safeReturnTo', () => {
  it.each([
    ['/a/dev/s/team%2Fdb?x=1', '/a/dev/s/team%2Fdb?x=1'],
    ['/', '/'],
    ['https://evil.example.com', '/'],
    ['//evil.example.com', '/'],
    ['/\\evil.example.com', '/'],
    ['/..//evil.com', '/'],
    ['/.//evil.com', '/'],
    ['/%2e%2e//evil.com', '/'],
    ['/a/../..//evil.com', '/'],
    ['/a/../b', '/b'],
    ['javascript:alert(1)', '/'],
    ['/a\r\nSet-Cookie: x', '/'],
    [undefined, '/'],
    [42, '/'],
  ])('%s → %s', (input, expected) => {
    expect(safeReturnTo(input)).toBe(expected)
  })
})
