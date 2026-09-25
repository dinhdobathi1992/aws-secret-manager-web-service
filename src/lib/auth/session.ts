import { getIronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { getConfig } from '@/lib/config'
import { SECURE_SESSION_COOKIE, SESSION_COOKIE } from './cookie-names'
import type { Role } from './rbac'

/** Absolute session lifetime. Group changes in Entra take effect at the next login, within 1h. */
export const SESSION_TTL_SECONDS = 60 * 60

export { SECURE_SESSION_COOKIE, SESSION_COOKIE }

export type SessionUser = {
  oid: string
  tid: string
  name: string
  upn: string
  roles: Record<string, Role>
  /** Absolute expiry, epoch seconds */
  exp: number
}

type SessionData = Partial<SessionUser>

/**
 * Secure cookies (and the __Host- prefix) follow the public URL scheme, not NODE_ENV, so the
 * production image also works over plain http://localhost for local container runs.
 */
export function isSecureDeployment(): boolean {
  return new URL(getConfig().APP_URL).protocol === 'https:'
}

export function sessionOptions(): SessionOptions {
  const secure = isSecureDeployment()
  return {
    password: getConfig().SESSION_SECRET,
    cookieName: secure ? SECURE_SESSION_COOKIE : SESSION_COOKIE,
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: { httpOnly: true, secure, sameSite: 'lax', path: '/' },
  }
}

async function ironSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions())
}

/** The signed-in user, or null when there is no valid, unexpired session. */
export async function readSession(): Promise<SessionUser | null> {
  const s = await ironSession()
  if (!s.oid || !s.exp || !s.roles || s.exp * 1000 <= Date.now()) return null
  return {
    oid: s.oid,
    tid: s.tid ?? '',
    name: s.name ?? '',
    upn: s.upn ?? '',
    roles: s.roles,
    exp: s.exp,
  }
}

export async function writeSession(user: SessionUser): Promise<void> {
  const s = await ironSession()
  Object.assign(s, user)
  await s.save()
}

export async function destroySession(): Promise<void> {
  const s = await ironSession()
  s.destroy()
}
