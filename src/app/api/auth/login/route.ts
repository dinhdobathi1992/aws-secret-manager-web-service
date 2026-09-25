import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { authCookieOptions } from '@/lib/auth/cookies'
import {
  CALLBACK_PATH,
  LOGIN_STATE_TTL_SECONDS,
  loginCookieName,
  safeReturnTo,
  sealLoginState,
} from '@/lib/auth/login-state'
import { beginLogin } from '@/lib/auth/oidc'
import { getConfig } from '@/lib/config'
import { errorFields, logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cfg = getConfig()
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get('returnTo'))
  try {
    const { url, loginState } = await beginLogin(returnTo)
    const jar = await cookies()
    jar.set(
      loginCookieName(loginState.state),
      await sealLoginState(loginState, cfg.SESSION_SECRET),
      authCookieOptions(LOGIN_STATE_TTL_SECONDS, CALLBACK_PATH),
    )
    return NextResponse.redirect(url, 303)
  } catch (err) {
    logger.error({ event: 'login_start_failed', ...errorFields(err) }, 'login start failed')
    return NextResponse.redirect(new URL('/login?error=unavailable', cfg.APP_URL), 303)
  }
}
