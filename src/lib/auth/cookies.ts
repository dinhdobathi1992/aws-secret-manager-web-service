import { isSecureDeployment } from './session'

/** Shared attributes for auth cookies set from route handlers. */
export function authCookieOptions(maxAge: number, path = '/') {
  return {
    httpOnly: true,
    secure: isSecureDeployment(),
    sameSite: 'lax' as const,
    path,
    maxAge,
  }
}
