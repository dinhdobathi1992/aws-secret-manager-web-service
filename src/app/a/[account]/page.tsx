import { LockIcon } from 'lucide-react'
import { AccountPicker } from '@/components/account-picker'
import { AwsErrorState } from '@/components/aws-error-state'
import { CreateSecretDialog } from '@/components/create-secret-dialog'
import { ListLayoutProvider, LayoutView } from '@/components/list-layout'
import { ListToolbar } from '@/components/list-toolbar'
import { Pager } from '@/components/pager'
import { SecretCards } from '@/components/secret-cards'
import { SecretsTable, type SortKey } from '@/components/secrets-table'
import { can } from '@/lib/auth/rbac'
import { listSecrets, type SecretSummary } from '@/lib/aws/secrets'
import { accountOptions, load, pageContext } from '@/lib/data/page-data'
import { PAGE_SIZES, requestTime } from '@/lib/ui/format'

export const dynamic = 'force-dynamic'

type RawSearch = Record<string, string | string[] | undefined>

/** First value of a query param; repeated params (?q=a&q=b) must not crash the page. */
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function sortItems(items: SecretSummary[], sort: SortKey, dir: 'asc' | 'desc') {
  const sign = dir === 'asc' ? 1 : -1
  return [...items].sort((a, b) =>
    sort === 'name'
      ? sign * a.name.localeCompare(b.name)
      : sign * (a.lastChangedDate ?? '').localeCompare(b.lastChangedDate ?? ''),
  )
}

export default async function SecretsPage({
  params,
  searchParams,
}: {
  params: Promise<{ account: string }>
  searchParams: Promise<RawSearch>
}) {
  const { account } = await params
  const raw = await searchParams
  const sp = {
    q: one(raw.q),
    tk: one(raw.tk),
    tv: one(raw.tv),
    cursor: one(raw.cursor),
    size: one(raw.size),
    sort: one(raw.sort),
    dir: one(raw.dir),
  }
  const { auth, client } = await pageContext(account, 'list')

  const size = PAGE_SIZES.find((s) => String(s) === sp.size) ?? 50
  const sort: SortKey = sp.sort === 'changed' ? 'changed' : 'name'
  const dir = sp.dir === 'desc' ? 'desc' : 'asc'
  // Tag filter: key and value travel separately (tag keys may contain ':').
  const tagKey = sp.tk?.trim() || undefined
  const tagValue = sp.tv ?? undefined

  const result = await load(() =>
    listSecrets(client, {
      search: sp.q?.trim() || undefined,
      tagKey,
      tagValue: tagValue || undefined,
      nextToken: sp.cursor,
      maxResults: size,
    }),
  )

  const hrefFor = (s: SortKey, d: 'asc' | 'desc') => {
    const next = new URLSearchParams(
      Object.entries(sp).filter(([, v]) => typeof v === 'string') as [string, string][],
    )
    next.set('sort', s)
    next.set('dir', d)
    return `?${next.toString()}`
  }

  // AWS matches tag-key and tag-value independently; keep only secrets with that exact pair.
  const matched = result.ok
    ? result.data.items.filter(
        (i) =>
          !tagKey || (Object.hasOwn(i.tags, tagKey) && (!tagValue || i.tags[tagKey] === tagValue)),
      )
    : []
  const items = sortItems(matched, sort, dir)
  const seen = new Set<string>()
  const tagOptions: { k: string; v: string }[] = []
  for (const [k, v] of items.flatMap((i) => Object.entries(i.tags))) {
    const id = JSON.stringify([k, v])
    if (seen.has(id) || tagOptions.length >= 5) continue
    seen.add(id)
    tagOptions.push({ k, v })
  }
  const now = requestTime()

  const canEdit = can(auth.role, 'update')
  const filtered = !!(sp.q || sp.tk)
  const count = `${items.length}${result.ok && result.data.nextToken ? '+' : ''}`

  return (
    <>
      <AccountPicker accounts={accountOptions(auth)} currentId={auth.account.id} />
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold text-foreground">Secrets</h1>
          <p className="text-[15px] text-muted-foreground">
            {result.ok
              ? `${count} ${filtered ? 'matching ' : ''}${items.length === 1 && !result.data.nextToken ? 'secret' : 'secrets'} in ${auth.account.name} · ${auth.account.region}`
              : `${auth.account.name} · ${auth.account.region}`}
          </p>
        </div>
        {can(auth.role, 'create') && (
          <CreateSecretDialog accountId={auth.account.id} accountName={auth.account.name} />
        )}
      </div>
      <ListLayoutProvider>
        <h2 className="sr-only">Secrets list</h2>
        <ListToolbar tagOptions={tagOptions} />
        {!result.ok ? (
          <AwsErrorState code={result.code} />
        ) : items.length ? (
          <LayoutView
            cards={
              <SecretCards
                accountId={auth.account.id}
                items={items}
                now={now}
                upn={auth.user.upn}
                canEdit={canEdit}
              />
            }
            table={
              <section className="surface overflow-hidden">
                <SecretsTable
                  accountId={auth.account.id}
                  items={items}
                  sort={sort}
                  dir={dir}
                  hrefFor={hrefFor}
                  now={now}
                />
              </section>
            }
          />
        ) : (
          <div className="surface flex flex-col items-center gap-1 px-5 py-16 text-center">
            <span className="font-medium text-foreground">No secrets found</span>
            <span className="text-sm text-muted-foreground">
              {filtered
                ? 'Try a different name prefix or tag.'
                : 'This account has no secrets yet.'}
            </span>
          </div>
        )}
        {result.ok && (
          <div className="surface">
            <Pager shown={items.length} size={size} nextToken={result.data.nextToken} />
          </div>
        )}
      </ListLayoutProvider>
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <LockIcon className="size-3.5" />
        Values stay hidden until you view them, and every view is recorded.
      </p>
    </>
  )
}
