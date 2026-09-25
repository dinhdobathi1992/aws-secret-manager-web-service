#!/usr/bin/env bash
# Local development with no cloud: moto as AWS, dev persona login instead of Entra.
set -euo pipefail
cd "$(dirname "$0")/.."

export MOCK_ACCOUNTS='[{"id":"dev-mock","name":"Dev (mock)","region":"ap-southeast-1","roleArn":"arn:aws:iam::000000000001:role/secrets-console","groups":{"reader":"00000000-0000-0000-0001-000000000001","writer":"00000000-0000-0000-0001-000000000002","admin":"00000000-0000-0000-0001-000000000003"}},{"id":"prod-mock","name":"Prod (mock)","region":"ap-southeast-1","roleArn":"arn:aws:iam::000000000002:role/secrets-console","groups":{"reader":"00000000-0000-0000-0002-000000000001","writer":"00000000-0000-0000-0002-000000000002","admin":"00000000-0000-0000-0002-000000000003"}}]'

# Exported values take precedence over .env, so a real .env never leaks into mock mode.
exec scripts/with-moto.sh bash -c 'set -euo pipefail
  pnpm exec tsx scripts/seed-moto.mts
  ACCOUNTS="$MOCK_ACCOUNTS" \
  APP_URL=http://localhost:3000 \
  SESSION_SECRET=dev-mock-session-secret-not-for-production-use \
  ENTRA_TENANT_ID=00000000-0000-0000-0000-000000000000 \
  ENTRA_CLIENT_ID=dev-mock ENTRA_CLIENT_SECRET=dev-mock \
  DEV_AUTH=1 \
  pnpm exec next dev
'
