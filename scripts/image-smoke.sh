#!/usr/bin/env bash
# Proves one built image works with two different APP_URL values: a server action succeeds in
# both, and a cross-origin action call is rejected. Backed by moto; no cloud access.
#   IMAGE=aws-secrets-console:2.0.0 scripts/image-smoke.sh
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE="${IMAGE:-aws-secrets-console:$(node -p "require('./package.json').version")}"
NET=sc-smoke
MOTO=sc-smoke-moto
MOTO_IMAGE="${MOTO_IMAGE:-motoserver/moto:5.2.2}"
SECRET=image-smoke-session-secret-not-for-production
ACCOUNTS='[{"id":"dev-mock","name":"Dev (mock)","region":"ap-southeast-1","roleArn":"arn:aws:iam::000000000001:role/secrets-console","groups":{"reader":"00000000-0000-0000-0001-000000000001","writer":"00000000-0000-0000-0001-000000000002","admin":"00000000-0000-0000-0001-000000000003"}}]'

cleanup() {
  docker rm -f sc-smoke-a sc-smoke-b "$MOTO" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM
cleanup

docker network create "$NET" >/dev/null
docker run -d --name "$MOTO" --network "$NET" -p 5056:5000 "$MOTO_IMAGE" >/dev/null
wait_for() { # url
  for _ in $(seq 1 60); do curl -fsS "$1" >/dev/null 2>&1 && return 0; sleep 0.5; done
  echo "FAIL: timed out waiting for $1"; exit 1
}
wait_for localhost:5056/moto-api/

env -u AWS_PROFILE AWS_ENDPOINT_URL=http://localhost:5056 AWS_ACCESS_KEY_ID=testing \
  AWS_SECRET_ACCESS_KEY=testing AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null \
  MOCK_ACCOUNTS="$ACCOUNTS" pnpm exec tsx scripts/seed-moto.mts

run_app() { # name hostPort appUrl
  docker run -d --name "$1" --network "$NET" -p "$2:3000" \
    --read-only --tmpfs /tmp --tmpfs /app/.next/cache:uid=1001,gid=1001 --cap-drop ALL \
    -e ACCOUNTS="$ACCOUNTS" -e APP_URL="$3" -e SESSION_SECRET="$SECRET" \
    -e ENTRA_TENANT_ID=00000000-0000-0000-0000-000000000000 -e ENTRA_CLIENT_ID=smoke -e ENTRA_CLIENT_SECRET=smoke \
    -e AWS_ENDPOINT_URL="http://$MOTO:5000" -e AWS_ACCESS_KEY_ID=testing -e AWS_SECRET_ACCESS_KEY=testing \
    -e AWS_REGION=ap-southeast-1 "$IMAGE" >/dev/null
}
run_app sc-smoke-a 3301 http://localhost:3301
run_app sc-smoke-b 3302 http://127.0.0.1:3302
for p in 3301 3302; do
  wait_for "localhost:$p/api/health?ready"
done

ACTION_ID=$(docker exec sc-smoke-a node -e "
const m=require('/app/.next/server/server-reference-manifest.json').node;
process.stdout.write(Object.keys(m).find(k=>m[k].exportedName==='revealSecret'))")

SESSION_SECRET="$SECRET" ACTION_ID="$ACTION_ID" pnpm exec tsx scripts/image-smoke-check.mts \
  http://localhost:3301 http://127.0.0.1:3302

# The revealed value must never reach the containers' stdout/stderr.
for c in sc-smoke-a sc-smoke-b; do
  if docker logs "$c" 2>&1 | grep -q 'fake-pass'; then echo "FAIL: secret value found in $c logs"; exit 1; fi
done
echo "PASS: no secret values in container logs"
