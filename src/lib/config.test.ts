import { describe, expect, it } from 'vitest'
import { ConfigError, loadConfig } from './config'

const account = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `${id} account`,
  region: 'ap-southeast-1',
  roleArn: 'arn:aws:iam::123456789012:role/secrets-console',
  groups: {
    reader: '11111111-1111-1111-1111-111111111111',
    writer: '22222222-2222-2222-2222-222222222222',
    admin: '33333333-3333-3333-3333-333333333333',
  },
  ...overrides,
})

const SECRET = 'x'.repeat(40)

const baseEnv = (accounts: unknown[] = [account('dev'), account('prod')]) => ({
  ACCOUNTS: JSON.stringify(accounts),
  APP_URL: 'http://localhost:3000',
  SESSION_SECRET: SECRET,
  ENTRA_TENANT_ID: 'tenant',
  ENTRA_CLIENT_ID: 'client',
  ENTRA_CLIENT_SECRET: 'client-secret',
})

function errorOf(env: Record<string, string | undefined>): string {
  try {
    loadConfig(env)
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigError)
    return (e as Error).message
  }
  throw new Error('expected loadConfig to throw')
}

describe('loadConfig', () => {
  it('parses a valid env and applies defaults', () => {
    const cfg = loadConfig(baseEnv())
    expect(cfg.ACCOUNTS.map((a) => a.id)).toEqual(['dev', 'prod'])
    expect(cfg.LOG_LEVEL).toBe('info')
    expect(cfg.APP_NAME).toBe('Secrets Console')
    expect(cfg.APP_LOGO_URL).toBeUndefined()
  })

  it('treats blank optional values as unset', () => {
    const cfg = loadConfig({ ...baseEnv(), APP_NAME: '', LOG_LEVEL: '', APP_LOGO_URL: '' })
    expect(cfg.APP_NAME).toBe('Secrets Console')
    expect(cfg.LOG_LEVEL).toBe('info')
  })

  it('reports a missing variable by name', () => {
    const env: Record<string, string | undefined> = { ...baseEnv() }
    delete env.ENTRA_CLIENT_ID
    expect(errorOf(env)).toMatch(/ENTRA_CLIENT_ID/)
  })

  it('rejects ACCOUNTS that is not JSON', () => {
    expect(errorOf({ ...baseEnv(), ACCOUNTS: '{nope' })).toMatch(/ACCOUNTS: is not valid JSON/)
  })

  it('rejects duplicate account ids', () => {
    expect(errorOf(baseEnv([account('dev'), account('dev')]))).toMatch(/duplicate account id "dev"/)
  })

  it('requires roleArn and names the account', () => {
    const bad = account('prod')
    delete (bad as Record<string, unknown>).roleArn
    expect(errorOf(baseEnv([account('dev'), bad]))).toMatch(/ACCOUNTS\[prod\]\.roleArn/)
  })

  it('requires the admin group and names the account', () => {
    const bad = account('prod', {
      groups: { reader: account('x').groups.reader, writer: account('x').groups.writer },
    })
    expect(errorOf(baseEnv([bad]))).toMatch(/ACCOUNTS\[prod\]\.groups\.admin/)
  })

  it('rejects a short session secret without echoing it', () => {
    const short = 'short-secret-value'
    const msg = errorOf({ ...baseEnv(), SESSION_SECRET: short })
    expect(msg).toMatch(/SESSION_SECRET/)
    expect(msg).not.toContain(short)
  })

  it('accepts same-origin and https logo URLs only', () => {
    expect(loadConfig({ ...baseEnv(), APP_LOGO_URL: '/logo.svg' }).APP_LOGO_URL).toBe('/logo.svg')
    expect(
      loadConfig({ ...baseEnv(), APP_LOGO_URL: 'https://cdn.example.com/l.svg' }).APP_LOGO_URL,
    ).toBe('https://cdn.example.com/l.svg')
    expect(errorOf({ ...baseEnv(), APP_LOGO_URL: '//evil.example.com/x.svg' })).toMatch(
      /APP_LOGO_URL/,
    )
    expect(errorOf({ ...baseEnv(), APP_LOGO_URL: 'http://cdn.example.com/x.svg' })).toMatch(
      /APP_LOGO_URL/,
    )
  })
})
