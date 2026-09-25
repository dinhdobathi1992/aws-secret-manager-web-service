import { redirect } from 'next/navigation'
import { safeReturnTo } from '@/lib/auth/login-state'
import { readSession } from '@/lib/auth/session'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

const ERRORS: Record<string, string> = {
  overage:
    'Your account has too many groups for the sign-in token. An administrator must configure the app registration to emit groups assigned to the application.',
  expired: 'The sign-in attempt expired or was already used. Please try again.',
  failed: 'Sign-in failed. Please try again.',
  unavailable: 'The identity provider is unavailable. Please try again shortly.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>
}) {
  const params = await searchParams
  const returnTo = safeReturnTo(params.returnTo)
  if (await readSession()) redirect(returnTo)

  const error =
    params.error && Object.hasOwn(ERRORS, params.error) ? ERRORS[params.error] : undefined
  let devPicker: React.ReactNode = null
  if (process.env.NODE_ENV === 'development' && process.env.DEV_AUTH === '1') {
    const { DevPersonaPicker } = await import('@/lib/auth/dev-login')
    devPicker = <DevPersonaPicker returnTo={returnTo} />
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="surface w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-foreground">{getConfig().APP_NAME}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with your organisation account.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {error}
          </p>
        )}
        {/* Plain link: the route handler redirects to Entra. */}
        <a
          href={`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`}
          className="mt-6 flex h-[42px] w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-button hover:bg-primary-hover"
        >
          Sign in with Microsoft
        </a>
        {devPicker}
      </div>
    </main>
  )
}
