import type { Account } from '@/lib/config'

/** Deterministic GUID per (account index, role) for tests. */
export const gid = (n: number, role: 1 | 2 | 3) =>
  `${String(n).padStart(8, '0')}-0000-0000-0000-00000000000${role}`

export const testAccount = (id: string, n: number): Account => ({
  id,
  name: `${id} account`,
  region: 'ap-southeast-1',
  roleArn: `arn:aws:iam::${String(n).padStart(12, '0')}:role/secrets-console`,
  groups: { reader: gid(n, 1), writer: gid(n, 2), admin: gid(n, 3) },
})

export const ACCOUNTS: Account[] = [testAccount('dev', 1), testAccount('prod', 2)]
