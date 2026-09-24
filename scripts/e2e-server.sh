#!/usr/bin/env bash
# Production build + standalone server against moto, for Playwright. All output goes to
# e2e/.server.log so the suite can prove no secret value was ever logged.
set -euo pipefail
cd "$(dirname "$0")/.."

export E2E_PORT="${E2E_PORT:-3400}"
export MOTO_PORT="${MOTO_PORT:-5058}"
LOG=e2e/.server.log
: > "$LOG"

if [ "${E2E_SKIP_BUILD:-0}" != 1 ]; then
  pnpm build >/dev/null
fi
# Standalone output does not include static assets; copy them next to server.js.
rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

exec scripts/with-moto.sh bash -c '
  set -euo pipefail
  MOCK_ACCOUNTS="$(cat e2e/accounts.json)" pnpm exec tsx scripts/seed-moto.mts
  ACCOUNTS="$(cat e2e/accounts.json)" \
  APP_URL="http://localhost:$E2E_PORT" \
  SESSION_SECRET=e2e-session-secret-0123456789abcdef-not-for-production \
  ENTRA_TENANT_ID=00000000-0000-0000-0000-000000000000 \
  ENTRA_CLIENT_ID=e2e ENTRA_CLIENT_SECRET=e2e \
  NODE_ENV=production PORT="$E2E_PORT" HOSTNAME=127.0.0.1 \
  node .next/standalone/server.js >> e2e/.server.log 2>&1
'
