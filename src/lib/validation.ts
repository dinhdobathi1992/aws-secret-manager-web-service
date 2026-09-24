import { z } from 'zod'
import { ACCOUNT_ID_RE } from '@/lib/config'

/** AWS Secrets Manager name rules. */
export const secretName = z.string().regex(/^[A-Za-z0-9/_+=.@-]{1,512}$/, 'invalid secret name')

export const accountId = z.string().regex(ACCOUNT_ID_RE, 'invalid account')

export const versionId = z.string().regex(/^[A-Za-z0-9-]{1,64}$/, 'invalid version id')

/** SecretString limit is 65,536 bytes. */
export const secretValue = z
  .string()
  .min(1, 'value is required')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 65_536, 'value exceeds 64 KB')

// AWS tag charset: letters, digits, space and _ . : / = + - @ (no tabs or newlines).
const notReserved = (k: string) => !k.toLowerCase().startsWith('aws:')
const tagKey = z
  .string()
  .regex(/^[\p{L}\p{N} _.:/=+@-]{1,128}$/u, 'invalid tag key')
  .refine(notReserved, 'aws: tags are reserved')
const tagValue = z.string().regex(/^[\p{L}\p{N} _.:/=+@-]{0,256}$/u, 'invalid tag value')

export const tags = z
  .record(tagKey, tagValue)
  .refine((t) => Object.keys(t).length <= 50, 'at most 50 tags')

export const description = z.string().max(2048)

const target = { accountId, name: secretName }

export const schemas = {
  reveal: z.object(target),
  versionValue: z.object({ ...target, versionId }),
  create: z.object({
    accountId,
    name: secretName,
    description: description.optional(),
    value: secretValue,
    tags: tags.optional(),
  }),
  update: z.object({ ...target, value: secretValue, baseVersionId: versionId }),
  tags: z
    .object({ ...target, set: tags.default({}), remove: z.array(tagKey).max(50).default([]) })
    .refine((t) => Object.keys(t.set).length > 0 || t.remove.length > 0, 'no tag change'),
  delete: z.object(target),
  restore: z.object(target),
  rollback: z.object({
    ...target,
    targetVersionId: versionId,
    expectedCurrentVersionId: versionId,
  }),
}
