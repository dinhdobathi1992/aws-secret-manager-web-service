import { NextResponse, type NextRequest } from 'next/server'
import { ConfigError, getConfig } from '@/lib/config'
import { errorFields, logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

/**
 * Liveness: 200 with no AWS call, so AWS trouble never restarts pods.
 * Readiness (`?ready`): also requires the configuration to parse.
 */
export function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.has('ready')) {
    try {
      getConfig()
    } catch (err) {
      // ConfigError messages name fields only, never values.
      if (err instanceof ConfigError) logger.error({ event: 'config_invalid' }, err.message)
      else logger.error({ event: 'readiness_failed', ...errorFields(err) }, 'readiness failed')
      return NextResponse.json({ status: 'config_error' }, { status: 503, headers: noStore })
    }
  }
  return NextResponse.json({ status: 'ok' }, { headers: noStore })
}
