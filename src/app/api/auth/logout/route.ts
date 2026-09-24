import { NextResponse } from 'next/server'
import { isSameOrigin } from '@/lib/auth/same-origin'
import { endSessionUrl } from '@/lib/auth/oidc'
import { destroySession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

/** POST from our own origin only, so another site can't sign the user out of the app or Entra. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 })
  await destroySession()
  return NextResponse.redirect(await endSessionUrl(), 303)
}
