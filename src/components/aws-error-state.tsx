import { TriangleAlertIcon } from 'lucide-react'
import { DOMAIN_MESSAGES, type DomainErrorCode } from '@/lib/aws/errors'

const HINT: Partial<Record<DomainErrorCode, string>> = {
  CredentialsExpired:
    'The app’s base AWS identity has expired. Locally, run `aws sso login` (or refresh your profile) and reload.',
  AccessDenied:
    'Check that the account role trusts the app’s identity and allows this action (see docs/iam-setup.md).',
}

/** Fixed, value-free message for a failed AWS read on a page. */
export function AwsErrorState({ code }: { code: DomainErrorCode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-1">
        <span className="font-medium">{DOMAIN_MESSAGES[code]}</span>
        {HINT[code] && <span>{HINT[code]}</span>}
      </div>
    </div>
  )
}
