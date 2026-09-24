#!/usr/bin/env bash
# Runs a command with a moto server (AWS fake) on MOTO_PORT.
# Reuses a moto already listening there; stops the container only if this script started it.
set -euo pipefail

MOTO_PORT="${MOTO_PORT:-5055}"          # not 5000: macOS AirPlay listens there
MOTO_IMAGE="${MOTO_IMAGE:-motoserver/moto:5.2.2}"
MOTO_NAME="sc-moto-${MOTO_PORT}"
ENDPOINT="http://localhost:${MOTO_PORT}"

if ! docker info >/dev/null 2>&1; then
  echo "with-moto: Docker is not running (try: colima start)" >&2
  exit 1
fi

started=0
cleanup() {
  if [ "${started}" = 1 ]; then docker stop "${MOTO_NAME}" >/dev/null 2>&1 || true; fi
}
# Installed before the container starts, so a timeout or Ctrl-C never orphans it.
trap cleanup EXIT
trap 'exit 130' INT TERM

if ! curl -fsS "${ENDPOINT}/moto-api/" >/dev/null 2>&1; then
  started=1
  docker run -d --rm --name "${MOTO_NAME}" -p "${MOTO_PORT}:5000" "${MOTO_IMAGE}" >/dev/null
  for _ in $(seq 1 60); do
    curl -fsS "${ENDPOINT}/moto-api/" >/dev/null 2>&1 && break
    sleep 0.5
  done
  curl -fsS "${ENDPOINT}/moto-api/" >/dev/null || { echo "with-moto: moto did not start" >&2; exit 1; }
fi

# Dummy base credentials: moto accepts anything, and nothing here can reach real AWS.
export AWS_ENDPOINT_URL="${ENDPOINT}"
export AWS_ACCESS_KEY_ID=testing AWS_SECRET_ACCESS_KEY=testing AWS_REGION=ap-southeast-1
# Empty (not unset): Next only fills undefined keys from .env, and the SDK treats "" as absent.
# Pointing the config files at /dev/null stops a real profile from being picked up at all.
export AWS_PROFILE= AWS_SESSION_TOKEN= AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null

# Run in the background and wait, so a SIGTERM to this script is handled promptly.
"$@" &
child=$!
trap 'kill -TERM "${child}" 2>/dev/null; wait "${child}"; exit 143' INT TERM
wait "${child}"
