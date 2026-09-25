/**
 * Calls the revealSecret server action over HTTP with a sealed session cookie, exactly as the
 * browser would. Prints pass/fail only; never prints the secret value.
 */
import { sealData } from 'iron-session'

const secret = process.env.SESSION_SECRET!
const actionId = process.env.ACTION_ID!
const bases = process.argv.slice(2)

const cookie = await sealData(
  {
    oid: 'smoke-user',
    tid: 'smoke',
    name: 'Smoke',
    upn: 'smoke@example.com',
    roles: { 'dev-mock': 'reader' },
    exp: Math.floor(Date.now() / 1000) + 600,
  },
  { password: secret, ttl: 600 },
)

async function callAction(base: string, origin: string) {
  const res = await fetch(`${base}/a/dev-mock/s/team/app/db`, {
    method: 'POST',
    headers: {
      'Next-Action': actionId,
      Origin: origin,
      Accept: 'text/x-component',
      'Content-Type': 'text/plain;charset=UTF-8',
      Cookie: `sc_session=${cookie}`,
    },
    body: JSON.stringify([{ accountId: 'dev-mock', name: 'team/app/db' }]),
  })
  const text = await res.text()
  return {
    status: res.status,
    ok: text.includes('"ok":true') && text.includes('"kind":"string"'),
    body: text,
  }
}

let failed = false
for (const base of bases) {
  const same = await callAction(base, new URL(base).origin)
  const cross = await callAction(base, 'https://evil.example.com')
  // Next rejects a mismatched Origin before running the action (500, no result payload).
  const pass = same.status === 200 && same.ok && cross.status === 500 && !cross.ok && !cross.body.includes('"kind"')
  failed ||= !pass
  console.log(
    `${pass ? 'PASS' : 'FAIL'} ${base}: same-origin action status=${same.status} ok=${same.ok}; cross-origin rejected=${!cross.ok} (status=${cross.status})`,
  )
}
process.exit(failed ? 1 : 0)
