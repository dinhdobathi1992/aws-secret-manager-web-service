import type { Instrumentation } from 'next'

/** Validates configuration at server start so a bad Helm value shows up in the first log line. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { ConfigError, getConfig } = await import('@/lib/config')
  const { logger } = await import('@/lib/logger')
  try {
    getConfig()
  } catch (err) {
    if (err instanceof ConfigError) logger.error({ event: 'config_invalid' }, err.message)
    else throw err
  }
}

/**
 * Structured record of server errors: route + error name/code/digest only, never the message.
 * Next still prints its own line for render errors; values stay out of it because every error
 * thrown from the AWS layer is a DomainError with a fixed message.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { errorFields, logger } = await import('@/lib/logger')
  logger.error(
    {
      event: 'request_error',
      method: request.method,
      route: context.routePath,
      routeType: context.routeType,
      ...errorFields(err),
    },
    'request error',
  )
}
