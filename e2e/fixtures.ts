import { test as base, expect, type BrowserContext, type Page } from '@playwright/test'
import {
  CreateSecretCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers'
import { sealData } from 'iron-session'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export const SESSION_SECRET = 'e2e-session-secret-0123456789abcdef-not-for-production'
export const PORT = Number(process.env.E2E_PORT ?? 3400)
export const MOTO = `http://localhost:${process.env.MOTO_PORT ?? 5058}`
export const SERVER_LOG = 'e2e/.server.log'
/** A non-JSON value planted in secrets; it must never appear in the server's output. */
export const PLANTED = 'e2e-planted-{not json}-VALUE'

type Role = 'reader' | 'writer' | 'admin'

/** Seals a session cookie exactly like the app does. No test bypass exists in the app. */
export async function login(context: BrowserContext, roles: Record<string, Role>, who = 'e2e') {
  const value = await sealData(
    {
      oid: `oid-${who}`,
      tid: 'e2e',
      name: `E2E ${who}`,
      upn: `${who}@e2e.test`,
      roles,
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    { password: SESSION_SECRET, ttl: 3600 },
  )
  await context.addCookies([
    { name: 'sc_session', value, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
  ])
}

/** Direct moto access for arranging test data (as the dev-mock account). */
export function mockClient() {
  return new SecretsManagerClient({
    region: 'ap-southeast-1',
    endpoint: MOTO,
    credentials: fromTemporaryCredentials({
      params: {
        RoleArn: 'arn:aws:iam::000000000001:role/secrets-console',
        RoleSessionName: 'e2e-arrange',
      },
      clientConfig: {
        region: 'ap-southeast-1',
        endpoint: MOTO,
        credentials: { accessKeyId: 'testing', secretAccessKey: 'testing' },
      },
    }),
  })
}

export async function arrangeSecret(
  value: Record<string, string> | string,
  versions: string[] = [],
) {
  const name = `e2e/${randomUUID().slice(0, 8)}/db`
  const client = mockClient()
  await client.send(
    new CreateSecretCommand({
      Name: name,
      SecretString: typeof value === 'string' ? value : JSON.stringify(value),
      Tags: [{ Key: 'team', Value: 'e2e' }],
    }),
  )
  for (const v of versions)
    await client.send(new PutSecretValueCommand({ SecretId: name, SecretString: v }))
  return name
}

export const secretPath = (name: string, tab?: string) =>
  `/a/dev-mock/s/${name.split('/').map(encodeURIComponent).join('/')}${tab ? `?tab=${tab}` : ''}`

export function serverLog(): string {
  return readFileSync(SERVER_LOG, 'utf8')
}

export function auditLines(): Array<Record<string, unknown>> {
  return serverLog()
    .split('\n')
    .filter((l) => l.includes('"type":"audit"'))
    .map((l) => JSON.parse(l))
}

/** Server action id from the build manifest, for calling an action directly. */
export function actionId(name: string): string {
  const m = JSON.parse(readFileSync('.next/server/server-reference-manifest.json', 'utf8')).node
  const id = Object.keys(m).find((k) => m[k].exportedName === name)
  if (!id) throw new Error(`action ${name} not found`)
  return id
}

export async function hidePage(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

export const test = base
export { expect }

/** Files under `dir` (skipping node_modules and the dev cache) that contain any needle. */
export function grepDir(dir: string, needles: string[]): string[] {
  const hits: string[] = []
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name === 'cache' || name === 'dev') continue
      const p = join(d, name)
      const st = statSync(p)
      if (st.isDirectory()) walk(p)
      else if (st.size < 5_000_000) {
        const text = readFileSync(p, 'latin1')
        if (needles.some((n) => text.includes(n))) hits.push(p)
      }
    }
  }
  walk(dir)
  return hits
}
