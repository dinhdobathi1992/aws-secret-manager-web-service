import pino from 'pino'

/**
 * JSON logs to stdout. Callers log allow-listed fields only; `redact` is defence in depth for
 * keys that must never appear even if an object is logged by mistake.
 */
export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'value',
        '*.value',
        'secretString',
        '*.secretString',
        'SecretString',
        '*.SecretString',
        'SecretBinary',
        '*.SecretBinary',
        'password',
        '*.password',
        'token',
        '*.token',
      ],
      censor: '[redacted]',
    },
    // process.stdout (not a raw fd) so tests can capture and scan everything the app writes.
  },
  process.stdout,
)

/**
 * Error logging that never includes messages or stacks, which can carry secret data. `code` is
 * kept when it looks like an identifier (openid-client / AWS error codes), because class names
 * are minified in production builds.
 */
export function errorFields(err: unknown): {
  errName: string
  errCode?: string
  errDigest?: string
} {
  if (err && typeof err === 'object') {
    const { name, code, digest } = err as { name?: unknown; code?: unknown; digest?: unknown }
    return {
      errName: typeof name === 'string' ? name : 'Error',
      ...(typeof code === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(code) ? { errCode: code } : {}),
      ...(typeof digest === 'string' ? { errDigest: digest } : {}),
    }
  }
  return { errName: typeof err }
}
