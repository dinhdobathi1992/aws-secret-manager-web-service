import { sealData, unsealData } from 'iron-session'

/** Per-attempt login state lives 10 minutes in its own cookie, so parallel tabs don't collide. */
export const LOGIN_STATE_TTL_SECONDS = 10 * 60
export const LOGIN_COOKIE_PREFIX = '__login_'
export const CALLBACK_PATH = '/api/auth/callback'

export type LoginState = {
  state: string
  nonce: string
  codeVerifier: string
  returnTo: string
}

export function loginCookieName(state: string): string {
  // state is base64url from openid-client; the prefix keeps the name short and cookie-safe.
  return `${LOGIN_COOKIE_PREFIX}${state.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16)}`
}

export function sealLoginState(data: LoginState, password: string): Promise<string> {
  return sealData(data, { password, ttl: LOGIN_STATE_TTL_SECONDS })
}

/** Returns the state only if the seal is intact, unexpired and belongs to `expectedState`. */
export async function unsealLoginState(
  sealed: string | undefined,
  expectedState: string,
  password: string,
): Promise<LoginState | null> {
  if (!sealed) return null
  const data = await unsealData<Partial<LoginState>>(sealed, {
    password,
    ttl: LOGIN_STATE_TTL_SECONDS,
  })
  if (!data.state || data.state !== expectedState || !data.nonce || !data.codeVerifier) return null
  return {
    state: data.state,
    nonce: data.nonce,
    codeVerifier: data.codeVerifier,
    returnTo: safeReturnTo(data.returnTo),
  }
}

/** Only same-origin relative paths are allowed, which blocks open redirects. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/'
  if (value.startsWith('//') || value.startsWith('/\\') || /[\r\n\t]/.test(value)) return '/'
  // A relative URL must resolve to the same origin.
  try {
    const url = new URL(value, 'http://x.invalid')
    if (url.origin !== 'http://x.invalid') return '/'
    // Check the normalised result: dot-segments can turn '/..//evil.com' into '//evil.com'.
    const out = `${url.pathname}${url.search}`
    if (!out.startsWith('/') || out.startsWith('//') || out.startsWith('/\\')) return '/'
    return out
  } catch {
    return '/'
  }
}
