'use server'

import * as sm from '@/lib/aws/secrets'
import { schemas } from '@/lib/validation'
import { withAction } from './with-action'

// The only surface that returns secret values or mutates secrets. Every export is authorized,
// validated and audited through withAction. Inputs are `unknown` because server actions are
// public HTTP endpoints: callers can send anything.

export async function revealSecret(input: unknown) {
  return withAction('reveal', schemas.reveal, input, ({ input, client }) =>
    sm.getSecretValue(client, input.name),
  )
}

export async function getVersionValue(input: unknown) {
  return withAction('reveal', schemas.versionValue, input, ({ input, client }) =>
    sm.getSecretValue(client, input.name, input.versionId),
  )
}

export async function createSecret(input: unknown) {
  return withAction('create', schemas.create, input, ({ input, client }) =>
    sm.createSecret(client, {
      name: input.name,
      description: input.description,
      value: input.value,
      tags: input.tags,
    }),
  )
}

export async function updateSecretValue(input: unknown) {
  return withAction('update', schemas.update, input, ({ input, client }) =>
    sm.putSecretValue(client, input.name, input.value, input.baseVersionId),
  )
}

export async function updateTags(input: unknown) {
  return withAction('tag', schemas.tags, input, ({ input, client }) =>
    sm.updateTags(client, input.name, { set: input.set, remove: input.remove }),
  )
}

export async function deleteSecret(input: unknown) {
  return withAction('delete', schemas.delete, input, ({ input, client }) =>
    sm.deleteSecret(client, input.name),
  )
}

export async function restoreSecret(input: unknown) {
  return withAction('restore', schemas.restore, input, ({ input, client }) =>
    sm.restoreSecret(client, input.name),
  )
}

export async function rollbackSecret(input: unknown) {
  return withAction('rollback', schemas.rollback, input, ({ input, client }) =>
    sm.rollbackSecret(client, input.name, input.targetVersionId, input.expectedCurrentVersionId),
  )
}
