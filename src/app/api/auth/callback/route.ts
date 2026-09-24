import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { LoginError, sessionFromClaims } from '@/lib/auth/claims'
import { authCookieOptions } from '@/lib/auth/cookies'
import { CALLBACK_PATH, loginCookieName, unsealLoginState } from '@/lib/auth/login-state'
import { completeLogin } from '@/lib/auth/oidc'
import { writeSession } from '@/lib/auth/session'
import { getConfig } from '@/lib/config'
import { errorFields, logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cfg = getConfig()
  const toLogin = (error: string) =>
    NextResponse.redirect(new URL(`/login?error=${error}`, cfg.APP_URL), 303)

  const params = request.nextUrl.searchParams
  const state = params.get('state') ?? ''
  const jar = await cookies()
  const cookieName = state ? loginCookieName(state) : ''
  const sealed = cookieName ? jar.get(cookieName)?.value : undefined
  if (cookieName) jar.set(cookieName, '', authCookieOptions(0, CALLBACK_PATH))

  if (params.get('error')) {
    // Entra-side error (user cancelled, AADSTS...). Log the code only.
    logger.warn(
      { event: 'login_idp_error', idpError: params.get('error')?.slice(0, 64) },
      'idp error',
    )
    return toLogin('failed')
  }

  const loginState = await unsealLoginState(sealed, state, cfg.SESSION_SECRET)
  if (!loginState) return toLogin('expired')

  try {
    const claims = await completeLogin(request.nextUrl.search, loginState)
    const user = sessionFromClaims(claims, cfg.ACCOUNTS)
    await writeSession(user)
    logger.info(
      { event: 'login', user: { oid: user.oid, upn: user.upn }, accounts: Object.keys(user.roles) },
      'login',
    )
    return NextResponse.redirect(new URL(loginState.returnTo, cfg.APP_URL), 303)
  } catch (err) {
    if (err instanceof LoginError && err.code === 'groups_overage') return toLogin('overage')
    logger.error({ event: 'login_failed', ...errorFields(err) }, 'login failed')
    return toLogin('failed')
  }
}
