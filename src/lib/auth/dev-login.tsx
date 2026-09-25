// DEV_PERSONA_LOGIN — development-only persona login. Only ever loaded through a dynamic import
// inside a literal `process.env.NODE_ENV === 'development'` branch, so production builds drop it.
// The build check greps .next for the marker above.
import { NextResponse, type NextRequest } from 'next/server'
import { getConfig } from '@/lib/config'
import { isRole, type Role } from './rbac'
import { SESSION_TTL_SECONDS, writeSession } from './session'
import { safeReturnTo } from './login-state'

export const DEV_PERSONA_MARKER = 'DEV_PERSONA_LOGIN'

export async function handleDevLogin(request: NextRequest): Promise<NextResponse> {
  const cfg = getConfig()
  const form = await request.formData()
  const roles: Record<string, Role> = {}
  for (const account of cfg.ACCOUNTS) {
    const value = form.get(`role:${account.id}`)
    if (isRole(value)) roles[account.id] = value
  }
  const persona = Object.entries(roles)
    .map(([id, role]) => `${id}-${role}`)
    .join('.')
  const oid = `dev-${persona || 'none'}`
  await writeSession({
    oid,
    tid: 'dev',
    name: `Dev ${persona || 'no role'}`,
    upn: `${oid}@dev.local`,
    roles,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  })
  return NextResponse.redirect(new URL(safeReturnTo(form.get('returnTo')), cfg.APP_URL), 303)
}

export function DevPersonaPicker({ returnTo }: { returnTo: string }) {
  const accounts = getConfig().ACCOUNTS
  return (
    <form
      method="post"
      action="/api/auth/dev"
      data-marker={DEV_PERSONA_MARKER}
      className="mt-6 space-y-3 rounded-md border border-dashed border-amber-500/60 p-4"
    >
      <p className="text-xs font-medium tracking-wide text-amber-600 uppercase">
        Dev persona login
      </p>
      <input type="hidden" name="returnTo" value={returnTo} />
      {accounts.map((a) => (
        <label key={a.id} className="flex items-center justify-between gap-3 text-sm">
          <span>{a.name}</span>
          <select
            name={`role:${a.id}`}
            defaultValue="admin"
            className="rounded border bg-transparent px-2 py-1"
          >
            <option value="">no role</option>
            <option value="reader">reader</option>
            <option value="writer">writer</option>
            <option value="admin">admin</option>
          </select>
        </label>
      ))}
      <button
        type="submit"
        className="w-full rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        Sign in as persona
      </button>
    </form>
  )
}
