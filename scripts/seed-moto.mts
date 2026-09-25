/**
 * Seeds moto with sample secrets in each mock account. Idempotent: existing names are skipped.
 * Runs only against AWS_ENDPOINT_URL (moto); refuses to run without it.
 */
import {
  CreateSecretCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers'

type MockAccount = { id: string; region: string; roleArn: string }

const endpoint = process.env.AWS_ENDPOINT_URL
const host = (() => {
  try {
    return new URL(endpoint ?? '').hostname
  } catch {
    return ''
  }
})()
if (host !== 'localhost' && host !== '127.0.0.1') {
  console.error('seed-moto: AWS_ENDPOINT_URL must point at a local moto server')
  process.exit(1)
}

const accounts = JSON.parse(process.env.MOCK_ACCOUNTS ?? '[]') as MockAccount[]

// Fake values only. Mixed shapes exercise the key/value editor, raw view and binary handling.
const SAMPLES: Array<{
  name: string
  value: string | Uint8Array
  tags?: Record<string, string>
  versions?: string[]
}> = [
  {
    name: 'team/app/db',
    value: JSON.stringify({
      host: 'db.internal',
      port: '5432',
      username: 'app',
      password: 'fake-pass-1',
    }),
    tags: { team: 'platform', env: 'dev' },
    versions: [
      JSON.stringify({
        host: 'db.internal',
        port: '5432',
        username: 'app',
        password: 'fake-pass-2',
      }),
      JSON.stringify({
        host: 'db.internal',
        port: '5433',
        username: 'app',
        password: 'fake-pass-3',
      }),
    ],
  },
  { name: 'team/app/api-key', value: 'fake-plain-api-key', tags: { team: 'platform' } },
  {
    name: 'billing/config',
    value: JSON.stringify({ currency: 'USD', retries: 3 }),
    tags: { team: 'billing' },
  },
  { name: 'odd/name+with=chars@x', value: JSON.stringify({ k: 'v' }) },
  { name: 'binary/cert', value: new Uint8Array([0xde, 0xad, 0xbe, 0xef]) },
]

async function seed(account: MockAccount) {
  const client = new SecretsManagerClient({
    region: account.region,
    credentials: fromTemporaryCredentials({
      params: { RoleArn: account.roleArn, RoleSessionName: 'seed', SourceIdentity: 'seed' },
      clientConfig: { region: account.region },
    }),
  })
  let created = 0
  for (const s of SAMPLES) {
    try {
      await client.send(
        new CreateSecretCommand({
          Name: s.name,
          ...(typeof s.value === 'string' ? { SecretString: s.value } : { SecretBinary: s.value }),
          Tags: Object.entries(s.tags ?? {}).map(([Key, Value]) => ({ Key, Value })),
        }),
      )
      for (const v of s.versions ?? []) {
        await client.send(new PutSecretValueCommand({ SecretId: s.name, SecretString: v }))
      }
      created++
    } catch (err) {
      if ((err as { name?: string }).name !== 'ResourceExistsException') throw err
    }
  }
  console.log(`seed-moto: ${account.id}: ${created} created, ${SAMPLES.length - created} existing`)
}

for (const account of accounts) await seed(account)
