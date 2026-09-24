import { z } from 'zod'

// Entra object ids are GUIDs; z.guid() accepts any 8-4-4-4-12 hex id without enforcing an RFC version.
const groupId = z.guid()

const accountSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'must be lowercase letters, digits or dashes'),
  name: z.string().min(1),
  region: z.string().regex(/^[a-z]{2}(-[a-z]+)+-\d$/, 'must be an AWS region like ap-southeast-1'),
  // Required everywhere, including local: the app always acts through AssumeRole.
  roleArn: z.string().regex(/^arn:aws:iam::\d{12}:role\/.+$/, 'must be an IAM role ARN'),
  groups: z.object({ reader: groupId, writer: groupId, admin: groupId }),
})

const accountsSchema = z
  .array(accountSchema)
  .min(1, 'at least one account is required')
  .superRefine((accounts, ctx) => {
    const seen = new Set<string>()
    accounts.forEach((a, i) => {
      if (seen.has(a.id)) {
        ctx.addIssue({ code: 'custom', path: [i, 'id'], message: `duplicate account id "${a.id}"` })
      }
      seen.add(a.id)
    })
  })

const logoUrl = z
  .string()
  .refine(
    (v) => (v.startsWith('/') && !v.startsWith('//')) || /^https:\/\/[^/]+/.test(v),
    'must be a same-origin path (/logo.svg) or an https URL',
  )

const envSchema = z.object({
  ACCOUNTS: accountsSchema,
  APP_URL: z.url({ protocol: /^https?$/ }),
  SESSION_SECRET: z.string().min(32, 'must be at least 32 characters'),
  // A GUID: multi-tenant aliases (common/organizations) fail OIDC issuer validation.
  ENTRA_TENANT_ID: z.guid(),
  ENTRA_CLIENT_ID: z.string().min(1),
  ENTRA_CLIENT_SECRET: z.string().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  APP_NAME: z.string().min(1).default('Secrets Console'),
  APP_LOGO_URL: logoUrl.optional(),
})

export type Account = z.infer<typeof accountSchema>
export type Config = z.infer<typeof envSchema>

export class ConfigError extends Error {
  override name = 'ConfigError'
}

/** Renders a zod path, naming accounts by id when known: ACCOUNTS[prod].groups.admin */
function formatPath(path: PropertyKey[], rawAccounts: unknown): string {
  let out = ''
  path.forEach((seg, i) => {
    if (typeof seg === 'number') {
      const id =
        i === 1 && path[0] === 'ACCOUNTS' && Array.isArray(rawAccounts)
          ? (rawAccounts[seg] as { id?: unknown } | undefined)?.id
          : undefined
      out += `[${typeof id === 'string' && id ? id : seg}]`
    } else {
      out += out ? `.${String(seg)}` : String(seg)
    }
  })
  return out
}

/** Parses and validates configuration. Throws ConfigError naming every failing field. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  let rawAccounts: unknown
  try {
    rawAccounts = env.ACCOUNTS === undefined ? undefined : JSON.parse(env.ACCOUNTS)
  } catch {
    // ACCOUNTS holds no secrets, but keep the message fixed anyway.
    throw new ConfigError('Invalid configuration:\n  ACCOUNTS: is not valid JSON')
  }

  const result = envSchema.safeParse({
    ...env,
    ACCOUNTS: rawAccounts,
    // Treat empty strings as unset so Helm/compose blanks fall back to defaults.
    LOG_LEVEL: env.LOG_LEVEL || undefined,
    APP_NAME: env.APP_NAME || undefined,
    APP_LOGO_URL: env.APP_LOGO_URL || undefined,
  })
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  ${formatPath(issue.path, rawAccounts) || '(root)'}: ${issue.message}`,
    )
    throw new ConfigError(`Invalid configuration:\n${lines.join('\n')}`)
  }
  return result.data
}

let cached: Config | undefined

/** Process-wide config, parsed once on first use. */
export function getConfig(): Config {
  cached ??= loadConfig()
  return cached
}

export function getAccount(id: string): Account | undefined {
  return getConfig().ACCOUNTS.find((a) => a.id === id)
}
