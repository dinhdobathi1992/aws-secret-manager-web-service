export type DomainErrorCode =
  | 'NotFound'
  | 'AlreadyExists'
  | 'AccessDenied'
  | 'InvalidRequest'
  | 'Conflict'
  | 'CredentialsExpired'
  | 'Unavailable'

/** Fixed, value-free messages. Never built from AWS error text, which can echo input. */
export const DOMAIN_MESSAGES: Record<DomainErrorCode, string> = {
  NotFound: 'Secret not found.',
  AlreadyExists: 'A secret with that name already exists.',
  AccessDenied: 'AWS denied this request for your role.',
  InvalidRequest: 'AWS rejected the request.',
  Conflict: 'The secret changed since you loaded it. Reload and try again.',
  CredentialsExpired:
    'AWS credentials expired. Run `aws sso login` (or refresh the base identity).',
  Unavailable: 'AWS is unavailable. Try again shortly.',
}

/** Allow-listed AWS diagnostics for server logs. Never the AWS message, which can echo input. */
export type AwsDiagnostics = { awsName?: string; requestId?: string; httpStatus?: number }

export class DomainError extends Error {
  override name = 'DomainError'
  constructor(
    readonly code: DomainErrorCode,
    readonly diagnostics: AwsDiagnostics = {},
  ) {
    super(DOMAIN_MESSAGES[code])
  }
}

const BY_NAME = new Map<string, DomainErrorCode>(
  Object.entries({
    ResourceNotFoundException: 'NotFound',
    ResourceExistsException: 'AlreadyExists',
    AccessDeniedException: 'AccessDenied',
    AccessDenied: 'AccessDenied',
    InvalidParameterException: 'InvalidRequest',
    InvalidRequestException: 'InvalidRequest',
    MalformedPolicyDocumentException: 'InvalidRequest',
    LimitExceededException: 'InvalidRequest',
    ExpiredToken: 'CredentialsExpired',
    ExpiredTokenException: 'CredentialsExpired',
    CredentialsProviderError: 'CredentialsExpired',
    TokenProviderError: 'CredentialsExpired',
    InvalidClientTokenId: 'CredentialsExpired',
    UnrecognizedClientException: 'CredentialsExpired',
    // IRSA base identity (AssumeRoleWithWebIdentity) failures
    InvalidIdentityTokenException: 'CredentialsExpired',
    IDPRejectedClaimException: 'CredentialsExpired',
    IDPCommunicationErrorException: 'Unavailable',
    InvalidNextTokenException: 'InvalidRequest',
    PackedPolicyTooLargeException: 'InvalidRequest',
    PreconditionNotMetException: 'InvalidRequest',
    // KMS failures behind Secrets Manager: the role can't use the secret's key
    DecryptionFailure: 'AccessDenied',
    EncryptionFailure: 'AccessDenied',
  }) as [string, DomainErrorCode][],
)

/** Maps SDK/STS errors onto domain errors. The original message is dropped on purpose. */
export function toDomainError(err: unknown): DomainError {
  if (err instanceof DomainError) return err
  const e = (err ?? {}) as {
    name?: unknown
    $metadata?: { requestId?: unknown; httpStatusCode?: unknown }
  }
  const name = typeof e.name === 'string' ? e.name : undefined
  const requestId = e.$metadata?.requestId
  const httpStatus = e.$metadata?.httpStatusCode
  return new DomainError((name && BY_NAME.get(name)) || 'Unavailable', {
    awsName: name,
    ...(typeof requestId === 'string' ? { requestId } : {}),
    ...(typeof httpStatus === 'number' ? { httpStatus } : {}),
  })
}
