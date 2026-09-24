import { AwsErrorState } from '@/components/aws-error-state'
import { CreateSecretDialog } from '@/components/create-secret-dialog'
import { ListToolbar } from '@/components/list-toolbar'
import { Pager } from '@/components/pager'
import { DOT, SecretsTable, type SortKey } from '@/components/secrets-table'
import { can } from '@/lib/auth/rbac'
import { listSecrets, type SecretSummary } from '@/lib/aws/secrets'
import { load, pageContext } from '@/lib/data/page-data'
import { FRESHNESS_LABEL, PAGE_SIZES, type Freshness, requestTime } from '@/lib/ui/format'
import { cn } from '@/lib/utils'

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

  return (
    <>
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Secrets</h1>
          <p className="text-sm text-muted-foreground">
            {auth.account.name} · {auth.account.region}
          </p>
        </div>
        {can(auth.role, 'create') && (
          <CreateSecretDialog accountId={auth.account.id} accountName={auth.account.name} />
        )}
      </div>
      <ListToolbar tagOptions={tagOptions} />
      {!result.ok ? (
        <AwsErrorState code={result.code} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(24,24,27,.04),0_8px_24px_-12px_rgba(24,24,27,.08)]">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="text-[15px] font-semibold">
                {sp.q || sp.tk ? 'Matching secrets' : 'All secrets'}
              </span>
              <span className="inline-flex h-[22px] items-center rounded-full bg-muted px-2 text-xs font-semibold">
                {items.length}
                {result.data.nextToken ? '+' : ''}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {(Object.keys(FRESHNESS_LABEL) as Freshness[]).map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5">
                  <span className={cn('size-2 rounded-full', DOT[f])} />
                  {FRESHNESS_LABEL[f]}
                </span>
              ))}
            </div>
          </div>
          {items.length ? (
            <SecretsTable
              accountId={auth.account.id}
              items={items}
              sort={sort}
              dir={dir}
              hrefFor={hrefFor}
              now={now}
            />
          ) : (
            <div className="flex flex-col items-center gap-1 px-5 py-16 text-center">
              <span className="font-medium">No secrets found</span>
              <span className="text-sm text-muted-foreground">
                {sp.q || sp.tk
                  ? 'Try a different name prefix or tag.'
                  : 'This account has no secrets yet.'}
              </span>
            </div>
          )}
          <Pager shown={items.length} size={size} nextToken={result.data.nextToken} />
        </div>
      )}
    </>
  )
}
