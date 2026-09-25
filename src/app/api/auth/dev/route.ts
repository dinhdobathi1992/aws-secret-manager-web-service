import { NextResponse, type NextRequest } from 'next/server'
import { isSameOrigin } from '@/lib/auth/same-origin'

export const dynamic = 'force-dynamic'

const notFound = () => new NextResponse(null, { status: 404 })

export async function POST(request: NextRequest) {
  // Literal NODE_ENV comparison: production builds constant-fold this branch away,
  // together with the dynamically imported dev-login module.
  if (process.env.NODE_ENV === 'development' && process.env.DEV_AUTH === '1') {
    if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 })
    const { handleDevLogin } = await import('@/lib/auth/dev-login')
    return handleDevLogin(request)
  }
  return notFound()
}

export const GET = notFound
