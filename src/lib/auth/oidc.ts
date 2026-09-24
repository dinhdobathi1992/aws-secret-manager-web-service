import * as client from 'openid-client'
import { getConfig } from '@/lib/config'
import { CALLBACK_PATH, type LoginState } from './login-state'

let configPromise: Promise<client.Configuration> | undefined

/** Entra discovery, cached per process. A failed discovery is retried on the next call. */
export function getOidcConfig(): Promise<client.Configuration> {
  if (!configPromise) {
    const cfg = getConfig()
    configPromise = client
      .discovery(
        new URL(`https://login.microsoftonline.com/${cfg.ENTRA_TENANT_ID}/v2.0`),
        cfg.ENTRA_CLIENT_ID,
        cfg.ENTRA_CLIENT_SECRET,
      )
      .catch((err: unknown) => {
        configPromise = undefined
        throw err
      })
  }
  return configPromise
}

export function redirectUri(): string {
  return new URL(CALLBACK_PATH, getConfig().APP_URL).toString()
}

/** Creates a fresh PKCE/state/nonce set and the Entra authorization URL for it. */
export async function beginLogin(returnTo: string): Promise<{ url: URL; loginState: LoginState }> {
  const oidc = await getOidcConfig()
  const codeVerifier = client.randomPKCECodeVerifier()
  const loginState: LoginState = {
    state: client.randomState(),
    nonce: client.randomNonce(),
    codeVerifier,
    returnTo,
  }
  const url = client.buildAuthorizationUrl(oidc, {
    redirect_uri: redirectUri(),
    scope: 'openid profile email',
    response_type: 'code',
    code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
    code_challenge_method: 'S256',
    state: loginState.state,
    nonce: loginState.nonce,
  })
  return { url, loginState }
}

/**
 * Exchanges the code and returns verified id_token claims. openid-client validates state, nonce,
 * issuer, audience and signature. The callback URL is rebuilt from APP_URL so it matches the
 * registered redirect URI behind a proxy.
 */
export async function completeLogin(
  search: string,
  loginState: LoginState,
): Promise<Record<string, unknown>> {
  const oidc = await getOidcConfig()
  const current = new URL(`${redirectUri()}${search}`)
  const tokens = await client.authorizationCodeGrant(oidc, current, {
    pkceCodeVerifier: loginState.codeVerifier,
    expectedState: loginState.state,
    expectedNonce: loginState.nonce,
    idTokenExpected: true,
  })
  const claims = tokens.claims()
  if (!claims) throw new Error('id_token missing')
  return claims as Record<string, unknown>
}

export async function endSessionUrl(): Promise<string> {
  const postLogout = new URL('/login', getConfig().APP_URL).toString()
  try {
    const oidc = await getOidcConfig()
    return client.buildEndSessionUrl(oidc, { post_logout_redirect_uri: postLogout }).toString()
  } catch {
    return postLogout
  }
}
