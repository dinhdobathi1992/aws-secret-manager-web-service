import {
  actionId,
  arrangeSecret,
  auditLines,
  expect,
  hidePage,
  login,
  PLANTED,
  secretPath,
  grepDir,
  serverLog,
  test,
} from './fixtures'

const ADMIN = { 'dev-mock': 'admin' } as const
const WRITER = { 'dev-mock': 'writer' } as const
const READER = { 'dev-mock': 'reader' } as const

test.describe('list', () => {
  test('lists, searches by prefix, and `/` focuses search', async ({ page, context }) => {
    await login(context, READER)
    await page.goto('/a/dev-mock')
    await expect(page.getByRole('heading', { name: 'Secrets' })).toBeVisible()
    await expect(page.getByRole('link', { name: /team\/app\/db/ }).first()).toBeVisible()
    await page.keyboard.press('/')
    await expect(page.getByLabel('Search secrets by name')).toBeFocused()
    await page.keyboard.type('billing')
    await expect(page).toHaveURL(/q=billing/)
    await expect(page.getByRole('link', { name: /billing\/config/ }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /team\/app\/db/ })).toHaveCount(0)
  })

  test('pages under /a are never cached', async ({ page, context }) => {
    await login(context, READER)
    const res = await page.goto('/a/dev-mock')
    expect(res?.headers()['cache-control']).toContain('no-store')
  })

  test('no role in an account → 404, not 403', async ({ page, context }) => {
    await login(context, READER)
    const res = await page.goto('/a/prod-mock')
    expect(res?.status()).toBe(404)
    await expect(page.getByText('Not found')).toBeVisible()
  })
})

test.describe('reveal', () => {
  test('values are absent until reveal, audited, and auto-mask after 30s and on hide', async ({
    page,
    context,
  }) => {
    const name = await arrangeSecret({ password: PLANTED })
    await login(context, READER, 'revealer')
    await page.clock.install()
    const res = await page.goto(secretPath(name))
    expect(await res!.text()).not.toContain(PLANTED)

    await page.getByRole('button', { name: 'Reveal values' }).click()
    await expect(page.getByLabel('Value for password', { exact: true })).toHaveValue(PLANTED)
    expect(
      auditLines().some(
        (l) => l.action === 'reveal' && l.secretName === name && l.outcome === 'ok',
      ),
    ).toBe(true)

    await page.clock.fastForward(31_000)
    await expect(page.getByText('Values are hidden')).toBeVisible()

    await page.getByRole('button', { name: 'Reveal values' }).click()
    await expect(page.getByLabel('Value for password', { exact: true })).toBeVisible()
    await hidePage(page)
    await expect(page.getByText('Values are hidden')).toBeVisible()
  })

  test('names with / + = @ open correctly', async ({ page, context }) => {
    await login(context, READER)
    await page.goto('/a/dev-mock')
    await page
      .getByRole('link', { name: /name\+with=chars@x/ })
      .first()
      .click()
    await expect(page.getByRole('heading', { name: 'odd/name+with=chars@x' })).toBeVisible()
  })
})

test.describe('writer', () => {
  test('create secret → lands on its detail page', async ({ page, context }) => {
    await login(context, WRITER)
    await page.goto('/a/dev-mock')
    await page.getByRole('button', { name: 'New secret' }).click()
    const name = `e2e/created/${Date.now()}`
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name', { exact: true }).fill(name)
    await dialog.getByLabel('Key', { exact: true }).fill('token')
    await dialog.getByLabel('Value for token', { exact: true }).fill(PLANTED)
    await dialog.getByRole('button', { name: 'Create secret' }).click()
    await expect(page.getByRole('heading', { name })).toBeVisible()
  })

  test('update shows a key-only diff and saves a new version', async ({ page, context }) => {
    const name = await arrangeSecret({ host: 'db', port: '5432' })
    await login(context, WRITER)
    await page.goto(secretPath(name))
    await page.getByRole('button', { name: 'Reveal values' }).click()
    await page.getByLabel('Value for port', { exact: true }).fill('6000')
    await page.getByRole('button', { name: 'Save new version' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByText('port')).toBeVisible()
    await expect(dialog.getByText('changed')).toBeVisible()
    await expect(dialog).not.toContainText('6000')
    await dialog.getByRole('button', { name: 'Save version' }).click()
    await expect(page.getByText('Saved a new version.')).toBeVisible()
  })

  test('a concurrent update is rejected with Conflict', async ({ browser }) => {
    const name = await arrangeSecret({ k: 'v1' })
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    await login(ctxA, WRITER, 'a')
    await login(ctxB, WRITER, 'b')
    const [a, b] = [await ctxA.newPage(), await ctxB.newPage()]
    for (const p of [a, b]) {
      await p.goto(secretPath(name))
      await p.getByRole('button', { name: 'Reveal values' }).click()
    }
    await a.getByLabel('Value for k', { exact: true }).fill('from-a')
    await a.getByRole('button', { name: 'Save new version' }).click()
    await a.getByRole('alertdialog').getByRole('button', { name: 'Save version' }).click()
    await expect(a.getByText('Saved a new version.')).toBeVisible()

    await b.getByLabel('Value for k', { exact: true }).fill('from-b')
    await b.getByRole('button', { name: 'Save new version' }).click()
    await b.getByRole('alertdialog').getByRole('button', { name: 'Save version' }).click()
    await expect(b.getByText('The secret changed since you revealed it.')).toBeVisible()
    await Promise.all([ctxA.close(), ctxB.close()])
  })

  test('edits tags', async ({ page, context }) => {
    const name = await arrangeSecret({ k: 'v' })
    await login(context, WRITER)
    await page.goto(secretPath(name, 'tags'))
    await page.getByRole('button', { name: 'Add tag' }).click()
    await page.getByLabel('Tag key').last().fill('owner')
    await page.getByLabel('Value for tag owner').fill('platform')
    await page.getByRole('button', { name: 'Save tags' }).click()
    await expect(page.getByText('Tags saved.')).toBeVisible()
  })
})

test.describe('admin', () => {
  test('rollback to a deprecated version', async ({ page, context }) => {
    const name = await arrangeSecret({ v: '1' }, [
      JSON.stringify({ v: '2' }),
      JSON.stringify({ v: '3' }),
    ])
    await login(context, ADMIN)
    await page.goto(secretPath(name, 'versions'))
    await expect(page.getByText('deprecated')).toBeVisible()
    const deprecatedRow = page.getByRole('row').filter({ hasText: 'deprecated' })
    await deprecatedRow.getByRole('button', { name: 'Make current' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByRole('button', { name: 'Make current' })).toBeEnabled()
    await dialog.getByRole('button', { name: 'Make current' }).click()
    await expect(page.getByText(/is now current/)).toBeVisible()
  })

  test('delete → scheduled deletion → restore', async ({ page, context }) => {
    const name = await arrangeSecret({ k: 'v' })
    await login(context, ADMIN)
    await page.goto(secretPath(name, 'danger'))
    await page.getByLabel(/to confirm/).fill(name)
    await page.getByRole('button', { name: 'Schedule deletion' }).click()
    await expect(page).toHaveURL(/\/deleted$/)
    const row = page.getByRole('row').filter({ hasText: name })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Restore' }).click()
    await expect(page.getByText(`Restored ${name}`)).toBeVisible()
  })

  test('activity page is admin-only', async ({ page, context }) => {
    await login(context, ADMIN)
    await page.goto('/a/dev-mock')
    await page.getByRole('link', { name: 'Activity' }).click()
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible()
  })
})

test.describe('reader limits', () => {
  test('write controls are hidden, and a direct action call is rejected and audited', async ({
    page,
    context,
  }) => {
    const name = await arrangeSecret({ k: 'v' })
    await login(context, READER, 'sneaky')
    await page.goto(secretPath(name))
    await expect(page.getByRole('link', { name: 'Danger zone' })).toHaveCount(0)
    await page.goto('/a/dev-mock')
    await expect(page.getByRole('button', { name: 'New secret' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Activity' })).toHaveCount(0)

    // Call deleteSecret directly, the way a crafted request would.
    const body = await page.evaluate(
      async ([id, secret]) => {
        const res = await fetch(location.pathname, {
          method: 'POST',
          headers: {
            'Next-Action': id,
            Accept: 'text/x-component',
            'Content-Type': 'text/plain;charset=UTF-8',
          },
          body: JSON.stringify([{ accountId: 'dev-mock', name: secret }]),
        })
        return res.text()
      },
      [actionId('deleteSecret'), name] as const,
    )
    expect(body).toContain('"code":"Forbidden"')
    expect(
      auditLines().some(
        (l) =>
          l.action === 'delete' &&
          l.outcome === 'denied' &&
          l.secretName === name &&
          (l.user as { oid: string })?.oid === 'oid-sneaky',
      ),
    ).toBe(true)

    await page.goto('/a/dev-mock/activity')
    await expect(page.getByText('This action requires admin')).toBeVisible()
  })
})

test.describe('value safety', () => {
  test('dev persona login is dead in production even with DEV_AUTH=1', async ({ request }) => {
    const res = await request.post('/api/auth/dev', { form: { 'role:dev-mock': 'admin' } })
    expect(res.status()).toBe(404)
  })

  test('a plain-text (non-JSON) value survives reveal, versions, update, rollback and delete', async ({
    page,
    context,
  }) => {
    const name = await arrangeSecret(PLANTED, [`${PLANTED}-v2`])
    await login(context, ADMIN, 'plain')
    await page.goto(secretPath(name))
    await page.getByRole('button', { name: 'Reveal values' }).click()
    const value = page.getByLabel('Secret value', { exact: true })
    await expect(value).toHaveValue(`${PLANTED}-v2`)
    await value.fill(`${PLANTED}-v3`)
    await page.getByRole('button', { name: 'Save new version' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Save version' }).click()
    await expect(page.getByText('Saved a new version.')).toBeVisible()

    await page.goto(secretPath(name, 'versions'))
    const previous = page.getByRole('row').filter({ hasText: 'AWSPREVIOUS' })
    await previous.getByRole('button', { name: 'Reveal' }).click()
    await expect(page.getByLabel('Version value')).toHaveValue(`${PLANTED}-v2`)
    await page.keyboard.press('Escape')
    await previous.getByRole('button', { name: 'Compare keys' }).click()
    await expect(page.getByText(/Compare .* current/)).toBeVisible()
    await previous.getByRole('button', { name: 'Make current' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Make current' }).click()
    await expect(page.getByText(/is now current/)).toBeVisible()

    await page.goto(secretPath(name, 'danger'))
    await page.getByLabel(/to confirm/).fill(name)
    await page.getByRole('button', { name: 'Schedule deletion' }).click()
    await expect(page).toHaveURL(/\/deleted$/)
  })

  test('unsaved edits pause auto-hide, even a half-typed row', async ({ page, context }) => {
    const name = await arrangeSecret({ k: 'v' })
    await login(context, WRITER)
    await page.clock.install()
    await page.goto(secretPath(name))
    await page.getByRole('button', { name: 'Reveal values' }).click()
    await page.getByRole('button', { name: 'Add key' }).click() // blank key: not yet a valid draft
    await page.clock.fastForward(31_000)
    await expect(page.getByLabel('Value for k', { exact: true })).toBeVisible()
    await expect(page.getByText('Auto-hide paused while you have unsaved changes')).toBeVisible()
  })

  test('no planted or seeded value in server output or build output', async () => {
    // Runs last (serial, single worker): every scenario above has already exercised the values.
    const log = serverLog()
    for (const v of [PLANTED, 'fake-pass-']) expect(log).not.toContain(v)
    const hits = grepDir('.next', [PLANTED, 'fake-pass-'])
    expect(hits).toEqual([])
  })
})
